import requests
import re

u = 'https://www.bbassets.com/monsters-inc/static/_next/static/chunks/pages/%5Blisting%5D/%5B%5B...slug%5D%5D-2a7c1c13be53f4df.js'
js = requests.get(u, timeout=30, headers={'User-Agent': 'Mozilla/5.0'}).text
print('len', len(js))

for token in ['listing-svc/v2/products', 'address', 'latitude', 'longitude', 'lat', 'lon', 'mid', 'AddressId', 'slug', 'type=pc', 'No Category Found']:
    i = js.find(token)
    print(token, i)
    if i != -1:
        print(js[max(0, i-280):i+420])
        print('-' * 60)

# Extract likely endpoints
endpoints = sorted(set(re.findall(r'https://www\.bigbasket\.com/[^\"\']+', js)))
print('endpoints', len(endpoints))
for e in endpoints[:50]:
    print(e)
