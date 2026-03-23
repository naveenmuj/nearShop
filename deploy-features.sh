#!/bin/bash
# Run ON THE VM to deploy billing, marketing, expenses features
# Usage: bash deploy-features.sh

echo "=== Deploying 3 new business features ==="

VENV_PY=$(find /opt/nearshop -path "*/venv/bin/python3" 2>/dev/null | head -1)
if [ -z "$VENV_PY" ]; then echo "ERROR: venv not found"; exit 1; fi
echo "Using: $VENV_PY"

# 1. Create DB tables
echo "[1/3] Creating database tables..."
cd /opt/nearshop
$VENV_PY -c "
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text('''
            CREATE TABLE IF NOT EXISTS bills (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                bill_number VARCHAR(30) UNIQUE NOT NULL,
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                customer_name VARCHAR(200),
                customer_phone VARCHAR(15),
                items JSONB NOT NULL,
                subtotal NUMERIC(10, 2) NOT NULL,
                gst_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
                gst_percentage NUMERIC(4, 2) NOT NULL DEFAULT 0,
                discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
                delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
                total NUMERIC(10, 2) NOT NULL,
                payment_method VARCHAR(20),
                payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        '''))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_bills_shop_id ON bills(shop_id)'))

        await conn.execute(text('''
            CREATE TABLE IF NOT EXISTS expenses (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                amount NUMERIC(10, 2) NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT,
                expense_date TIMESTAMPTZ DEFAULT now(),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        '''))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_expenses_shop_id ON expenses(shop_id)'))
    print('  Tables created!')

asyncio.run(migrate())
"

# 2. Copy backend modules
echo "[2/3] Copying backend modules..."
for dir in billing marketing expenses; do
    if [ -d "/root/nearShop/nearshop-api/app/$dir" ]; then
        cp -r "/root/nearShop/nearshop-api/app/$dir" "/opt/nearshop/app/$dir"
        echo "  Copied $dir/"
    else
        echo "  WARNING: $dir/ not found in nearShop repo"
    fi
done

# Copy updated main.py
cp /root/nearShop/nearshop-api/app/main.py /opt/nearshop/app/main.py
echo "  Copied main.py"

# 3. Restart service
echo "[3/3] Restarting service..."
systemctl restart nearshop-api
sleep 2

if systemctl is-active --quiet nearshop-api; then
    echo "  Service running!"
    echo ""
    echo "=== Quick API test ==="
    curl -s http://localhost:8000/api/v1/health
    echo ""
    echo ""
    echo "Testing billing endpoint..."
    curl -s http://localhost:8000/api/v1/billing/stats 2>&1 | head -1
    echo ""
    echo "=== Deploy complete! ==="
else
    echo "  ERROR: Service failed"
    journalctl -u nearshop-api --no-pager -n 20
fi
