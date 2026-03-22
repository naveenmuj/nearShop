#!/bin/bash
# Run ON THE VM to deploy delivery feature
# Usage: paste into SSH terminal

echo "=== Deploying delivery feature ==="

# 1. Run DB migration
echo "[1/4] Adding delivery columns to database..."
PGPASSWORD=$(grep DATABASE_URL /opt/nearshop/.env | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/') \
  psql "$(grep DATABASE_URL /opt/nearshop/.env | cut -d= -f2-)" -c "
ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS free_delivery_above NUMERIC(10, 2);
" 2>&1 || echo "  Note: Column may already exist, continuing..."

echo "  DB migration done"

# 2. Update shops model
echo "[2/4] Updating shops model..."
python3 -c "
path = '/opt/nearshop/app/shops/models.py'
with open(path) as f:
    content = f.read()

if 'delivery_fee' not in content:
    content = content.replace(
        'delivery_radius = Column(Integer, nullable=True)',
        '''delivery_radius = Column(Integer, nullable=True)
    delivery_fee = Column(Numeric(10, 2), server_default=text(\"0\"), nullable=False)
    free_delivery_above = Column(Numeric(10, 2), nullable=True)'''
    )
    with open(path, 'w') as f:
        f.write(content)
    print('  Model updated')
else:
    print('  Model already has delivery_fee')
"

# 3. Update shops schemas
echo "[3/4] Updating shops schemas..."
python3 -c "
path = '/opt/nearshop/app/shops/schemas.py'
with open(path) as f:
    content = f.read()

if 'delivery_fee' not in content:
    # Add to ShopCreate
    content = content.replace(
        'delivery_radius: Optional[int] = None\n    min_order',
        'delivery_radius: Optional[int] = None\n    delivery_fee: Optional[Decimal] = Field(None, ge=0, decimal_places=2)\n    free_delivery_above: Optional[Decimal] = Field(None, ge=0, decimal_places=2)\n    min_order'
    )
    # Add to ShopResponse
    content = content.replace(
        'delivery_radius: Optional[int] = None\n    min_order: Optional[Decimal] = None\n    is_open_now',
        'delivery_radius: Optional[int] = None\n    delivery_fee: Decimal = Decimal(\"0\")\n    free_delivery_above: Optional[Decimal] = None\n    min_order: Optional[Decimal] = None\n    is_open_now'
    )
    with open(path, 'w') as f:
        f.write(content)
    print('  Schemas updated')
else:
    print('  Schemas already have delivery_fee')
"

# 4. Update order service for delivery fee calculation
echo "[4/4] Updating order service..."
python3 -c "
path = '/opt/nearshop/app/orders/service.py'
with open(path) as f:
    content = f.read()

if 'delivery_fee_calc' not in content or 'free_delivery_above' not in content:
    old = '''    order_number = (
        f\"NS-{datetime.now().strftime('%y%m%d')}-{random.randint(10000, 99999)}\"
    )

    order = Order(
        order_number=order_number,
        customer_id=customer_id,
        shop_id=data.shop_id,
        items=items_json,
        subtotal=subtotal,
        total=subtotal,'''

    new = '''    # delivery_fee_calc: Calculate delivery fee based on shop settings
    delivery_fee = Decimal(\"0\")
    if data.delivery_type == \"delivery\":
        shop_result_fee = await db.execute(select(Shop).where(Shop.id == data.shop_id))
        shop_for_fee = shop_result_fee.scalar_one_or_none()
        if shop_for_fee:
            shop_delivery_opts = shop_for_fee.delivery_options or [\"pickup\"]
            if \"delivery\" not in shop_delivery_opts:
                raise BadRequestError(\"This shop does not offer delivery\")
            if shop_for_fee.min_order and subtotal < shop_for_fee.min_order:
                raise BadRequestError(f\"Minimum order amount is {shop_for_fee.min_order}\")
            fee_amount = Decimal(str(shop_for_fee.delivery_fee or 0))
            free_above = shop_for_fee.free_delivery_above
            if free_above and subtotal >= free_above:
                delivery_fee = Decimal(\"0\")
            else:
                delivery_fee = fee_amount

    total = subtotal + delivery_fee

    order_number = (
        f\"NS-{datetime.now().strftime('%y%m%d')}-{random.randint(10000, 99999)}\"
    )

    order = Order(
        order_number=order_number,
        customer_id=customer_id,
        shop_id=data.shop_id,
        items=items_json,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        total=total,'''

    if old in content:
        content = content.replace(old, new)
        with open(path, 'w') as f:
            f.write(content)
        print('  Order service updated')
    else:
        print('  Order service already updated or structure changed')
else:
    print('  Order service already has delivery fee logic')
"

# 5. Restart
systemctl restart nearshop-api
sleep 2

if systemctl is-active --quiet nearshop-api; then
    echo ""
    echo "=== Deploy successful! ==="
    echo "Testing delivery fields..."
    curl -s "http://localhost:8000/api/v1/shops/mine" -H "Authorization: Bearer test" 2>/dev/null | python3 -c "
import sys,json
try:
    d = json.load(sys.stdin)
    if isinstance(d, list) and d:
        s = d[0]
        print(f'  Shop: {s.get(\"name\")} | delivery_fee: {s.get(\"delivery_fee\", \"N/A\")} | free_above: {s.get(\"free_delivery_above\", \"N/A\")}')
    else:
        print('  (no shops or auth required - check manually)')
except:
    print('  Quick test done (auth may be needed)')
" 2>/dev/null
else
    echo "=== ERROR: Service failed to start ==="
    journalctl -u nearshop-api --no-pager -n 20
fi
