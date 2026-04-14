import requests
import re

u = 'https://www.bbassets.com/monsters-inc/static/_next/static/chunks/pages/_app-8190557c88249902.js'
js = requests.get(u, timeout=30).text

term = 'internal-svc.bigbasket.com'
idx = js.find(term)
print('idx', idx)
if idx != -1:
    start = max(0, idx - 500)
    end = min(len(js), idx + 1500)
    print(js[start:end])

print('\nBigBasket-related URLs:')
for m in re.findall(r'https?://[^"\']+', js):
    if 'bigbasket' in m:
        print(m)
