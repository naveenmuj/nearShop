#!/bin/bash
# Deploy inventory, shop toggle, EOD reports to VM
# Run ON THE VM: bash deploy-operational.sh

echo "=== Deploying operational features ==="

VENV_PY=$(find /opt/nearshop -path "*/venv/bin/python3" 2>/dev/null | head -1)
if [ -z "$VENV_PY" ]; then echo "ERROR: venv not found"; exit 1; fi

cd /opt/nearshop

# 1. Create stock_logs table + add product columns
echo "[1/3] Running DB migrations..."
$VENV_PY -c "
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        # Stock columns on products
        await conn.execute(text('ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER'))
        await conn.execute(text(\"ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_unit VARCHAR(20) DEFAULT 'pieces'\"))
        await conn.execute(text('ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5'))
        await conn.execute(text('ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2)'))

        # Stock logs table
        await conn.execute(text('''
            CREATE TABLE IF NOT EXISTS stock_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                change_type VARCHAR(20) NOT NULL,
                quantity_change INTEGER NOT NULL,
                quantity_after INTEGER,
                purchase_price NUMERIC(10, 2),
                supplier_name VARCHAR(200),
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        '''))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_stock_logs_product ON stock_logs(product_id)'))
    print('  Migrations done!')

asyncio.run(migrate())
"

# 2. Copy files
echo "[2/3] Copying backend files..."
# Inventory module
if [ -d "/root/nearShop/nearshop-api/app/inventory" ]; then
    cp -r /root/nearShop/nearshop-api/app/inventory /opt/nearshop/app/inventory
    echo "  Copied inventory/"
fi

# Updated files
for f in main.py products/models.py orders/service.py shops/router.py; do
    if [ -f "/root/nearShop/nearshop-api/app/$f" ]; then
        cp "/root/nearShop/nearshop-api/app/$f" "/opt/nearshop/app/$f"
        echo "  Copied app/$f"
    fi
done

# 3. Restart
echo "[3/3] Restarting service..."
systemctl restart nearshop-api
sleep 2

if systemctl is-active --quiet nearshop-api; then
    echo "  Service running!"
    echo ""
    echo "=== Quick tests ==="
    curl -s http://localhost:8000/api/v1/health && echo ""
    echo "Inventory endpoint:"
    curl -s http://localhost:8000/api/v1/inventory/value 2>&1 | head -1
    echo ""
    echo "=== Deploy complete! ==="
else
    echo "  ERROR: Service failed"
    journalctl -u nearshop-api --no-pager -n 20
fi
