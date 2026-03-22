#!/bin/bash
# Run ON THE VM to update service.py (search geo fix)
# Paste this into your VM SSH terminal

echo "=== Updating products/service.py ==="

python3 -c "
import re

path = '/opt/nearshop/app/products/service.py'
with open(path, 'r') as f:
    content = f.read()

# Fix 1: Change radius_km default from 10.0 to None
content = content.replace(
    'radius_km: float = 10.0,',
    'radius_km: Optional[float] = None,'
)

# Fix 2: Geo filter only when radius explicitly provided
old_geo = '''    # Geo filter
    if lat is not None and lng is not None:
        base_query = base_query.where(
            within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km)
        )'''

new_geo = '''    # Geo filter -- ONLY when radius explicitly provided
    if lat is not None and lng is not None and radius_km is not None:
        base_query = base_query.where(
            within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km)
        )'''

content = content.replace(old_geo, new_geo)

# Fix 3: Add distance ordering when lat/lng present but no explicit sort
old_sort_else = '''    else:
        base_query = base_query.order_by(Product.created_at.desc())'''

new_sort_else = '''    elif lat is not None and lng is not None:
        from app.core.geo import haversine_distance_km as _hav
        dist = _hav(lat, lng, Shop.latitude, Shop.longitude)
        base_query = base_query.order_by(dist, Product.created_at.desc())
    else:
        base_query = base_query.order_by(Product.created_at.desc())'''

content = content.replace(old_sort_else, new_sort_else, 1)

with open(path, 'w') as f:
    f.write(content)

print('  service.py patched successfully')
"

systemctl restart nearshop-api
sleep 2

if systemctl is-active --quiet nearshop-api; then
    echo "  Service restarted OK"
else
    echo "  ERROR: Service failed!"
    journalctl -u nearshop-api --no-pager -n 15
    exit 1
fi

# Quick test with lat/lng
echo ""
echo "=== Test: search with lat/lng (should return results) ==="
curl -s "http://localhost:8000/api/v1/products/search?q=test&lat=19.05&lng=72.82" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  total={d.get(\"total\",0)}, items={len(d.get(\"items\",[]))}')"
echo ""
echo "=== Done! ==="
