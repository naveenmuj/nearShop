#!/bin/bash
# Run ON THE VM to add delivery columns to database
# Usage: bash run-migration.sh

echo "=== Running DB migration ==="

cd /opt/nearshop

python3 -c "
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text('ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0'))
        await conn.execute(text('ALTER TABLE shops ADD COLUMN IF NOT EXISTS free_delivery_above NUMERIC(10,2)'))
    print('  Columns added successfully!')

asyncio.run(migrate())
"

if [ $? -ne 0 ]; then
    echo "  ERROR: Migration failed"
    exit 1
fi

echo "=== Restarting service ==="
systemctl restart nearshop-api
sleep 2

if systemctl is-active --quiet nearshop-api; then
    echo "  Service running"
else
    echo "  ERROR: Service failed"
    journalctl -u nearshop-api --no-pager -n 15
    exit 1
fi

echo ""
echo "=== Quick API test ==="
curl -s "http://localhost:8000/api/v1/shops/search?q=test" | python3 -c "
import sys,json
d = json.load(sys.stdin)
total = d.get('total', 0)
if total > 0:
    shop = d['items'][0]
    print(f'  OK: {total} shops found')
    print(f'  First shop: {shop[\"name\"]}')
    print(f'  delivery_fee: {shop.get(\"delivery_fee\", \"N/A\")}')
    print(f'  free_delivery_above: {shop.get(\"free_delivery_above\", \"N/A\")}')
    print(f'  delivery_options: {shop.get(\"delivery_options\", \"N/A\")}')
else:
    print('  No shops found (empty DB?)')
"

echo ""
echo "=== Done! ==="
