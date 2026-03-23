#!/bin/bash
# Deploy broadcast, advisor, public shop features to VM
# Run ON THE VM: bash deploy-growth.sh

echo "=== Deploying growth & intelligence features ==="

VENV_PY=$(find /opt/nearshop -path "*/venv/bin/python3" 2>/dev/null | head -1)
if [ -z "$VENV_PY" ]; then echo "ERROR: venv not found"; exit 1; fi

cd /opt/nearshop

# 1. Create broadcast_messages table
echo "[1/3] Running DB migration..."
$VENV_PY -c "
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
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
    print('  Tables created!')

asyncio.run(migrate())
"

# 2. Copy backend modules
echo "[2/3] Copying backend files..."
for dir in broadcast advisor; do
    if [ -d "/root/nearShop/nearshop-api/app/$dir" ]; then
        cp -r "/root/nearShop/nearshop-api/app/$dir" "/opt/nearshop/app/$dir"
        echo "  Copied $dir/"
    fi
done

# Updated files
for f in main.py shops/router.py; do
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
    echo ""
    echo "Testing public shop endpoint..."
    curl -s "http://localhost:8000/api/v1/shops/public/test-shop" 2>&1 | $VENV_PY -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if 'shop' in d:
        print(f'  Public page: {d[\"shop\"][\"name\"]} - {len(d.get(\"products\",[]))} products')
    else:
        print(f'  Response: {str(d)[:100]}')
except: print('  (could not parse)')
" 2>/dev/null
    echo ""
    echo "Testing advisor endpoint..."
    curl -s http://localhost:8000/api/v1/advisor/suggestions 2>&1 | head -1
    echo ""
    echo "=== Deploy complete! ==="
else
    echo "  ERROR: Service failed"
    journalctl -u nearshop-api --no-pager -n 20
fi
