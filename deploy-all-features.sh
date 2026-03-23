#!/bin/bash
# MASTER DEPLOY: All 10 features to VM
# Run ON THE VM: bash deploy-all-features.sh

set -e
echo "=============================================="
echo "  NearShop — Deploy ALL Features"
echo "=============================================="

VENV_PY=$(find /opt/nearshop -path "*/venv/bin/python3" 2>/dev/null | head -1)
if [ -z "$VENV_PY" ]; then echo "ERROR: venv not found"; exit 1; fi
echo "Python: $VENV_PY"

cd /opt/nearshop

# ── Step 1: DB Migrations ────────────────────────────────────────
echo ""
echo "[1/4] Running ALL database migrations..."
$VENV_PY -c "
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        # Delivery columns on shops
        await conn.execute(text('ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0'))
        await conn.execute(text('ALTER TABLE shops ADD COLUMN IF NOT EXISTS free_delivery_above NUMERIC(10,2)'))

        # Stock columns on products
        await conn.execute(text('ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER'))
        await conn.execute(text(\"ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_unit VARCHAR(20) DEFAULT 'pieces'\"))
        await conn.execute(text('ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5'))
        await conn.execute(text('ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2)'))

        # Bills table
        await conn.execute(text('''
            CREATE TABLE IF NOT EXISTS bills (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                bill_number VARCHAR(30) UNIQUE NOT NULL,
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                customer_name VARCHAR(200), customer_phone VARCHAR(15),
                items JSONB NOT NULL,
                subtotal NUMERIC(10,2) NOT NULL,
                gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                gst_percentage NUMERIC(4,2) NOT NULL DEFAULT 0,
                discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
                total NUMERIC(10,2) NOT NULL,
                payment_method VARCHAR(20),
                payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        '''))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_bills_shop ON bills(shop_id)'))

        # Expenses table
        await conn.execute(text('''
            CREATE TABLE IF NOT EXISTS expenses (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                amount NUMERIC(10,2) NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT,
                expense_date TIMESTAMPTZ DEFAULT now(),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        '''))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_expenses_shop ON expenses(shop_id)'))

        # Stock logs table
        await conn.execute(text('''
            CREATE TABLE IF NOT EXISTS stock_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                change_type VARCHAR(20) NOT NULL,
                quantity_change INTEGER NOT NULL,
                quantity_after INTEGER,
                purchase_price NUMERIC(10,2),
                supplier_name VARCHAR(200),
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        '''))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_stock_logs_product ON stock_logs(product_id)'))

        # Broadcast messages table
        await conn.execute(text('''
            CREATE TABLE IF NOT EXISTS broadcast_messages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                title VARCHAR(200) NOT NULL,
                body TEXT NOT NULL,
                target_segment VARCHAR(50) DEFAULT 'all',
                target_filter JSONB,
                recipients_count INTEGER DEFAULT 0,
                sent_at TIMESTAMPTZ DEFAULT now(),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        '''))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_broadcast_shop ON broadcast_messages(shop_id)'))

    print('  All tables and columns created!')

asyncio.run(migrate())
"

# ── Step 2: Copy ALL backend modules ──────────────────────────────
echo ""
echo "[2/4] Copying ALL backend modules..."

REPO=/root/nearShop/nearshop-api/app

# New modules
for dir in billing marketing expenses inventory broadcast advisor; do
    if [ -d "$REPO/$dir" ]; then
        rm -rf /opt/nearshop/app/$dir
        cp -r "$REPO/$dir" /opt/nearshop/app/$dir
        echo "  + $dir/"
    fi
done

# Updated core files
for f in main.py shops/router.py shops/models.py shops/schemas.py products/models.py orders/service.py products/router.py products/service.py; do
    if [ -f "$REPO/$f" ]; then
        cp "$REPO/$f" "/opt/nearshop/app/$f"
        echo "  ~ app/$f"
    fi
done

# ── Step 3: Restart ───────────────────────────────────────────────
echo ""
echo "[3/4] Restarting nearshop-api..."
systemctl restart nearshop-api
sleep 3

if ! systemctl is-active --quiet nearshop-api; then
    echo "  ERROR: Service failed to start!"
    journalctl -u nearshop-api --no-pager -n 25
    exit 1
fi
echo "  Service running!"

# ── Step 4: Verify ────────────────────────────────────────────────
echo ""
echo "[4/4] Quick verification..."

echo -n "  Health: "
curl -s http://localhost:8000/api/v1/health | $VENV_PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null

echo -n "  Billing: "
curl -s http://localhost:8000/api/v1/billing/stats 2>&1 | head -c 50
echo ""

echo -n "  Marketing: "
curl -s http://localhost:8000/api/v1/marketing/festivals 2>&1 | head -c 50
echo ""

echo -n "  Expenses: "
curl -s "http://localhost:8000/api/v1/expenses?period=7d" 2>&1 | head -c 50
echo ""

echo -n "  Inventory: "
curl -s http://localhost:8000/api/v1/inventory/value 2>&1 | head -c 50
echo ""

echo -n "  Broadcast: "
curl -s http://localhost:8000/api/v1/broadcast/segments 2>&1 | head -c 50
echo ""

echo -n "  Advisor: "
curl -s http://localhost:8000/api/v1/advisor/suggestions 2>&1 | head -c 50
echo ""

echo ""
echo "=============================================="
echo "  Deploy complete! Run test_all_apis.py"
echo "  to verify all endpoints."
echo "=============================================="
