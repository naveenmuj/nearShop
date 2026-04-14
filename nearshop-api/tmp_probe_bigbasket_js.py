import requests
import re
from bs4 import BeautifulSoup

url = 'https://www.bigbasket.com/cl/fruits/6'
html = requests.get(url, timeout=30, headers={'User-Agent':'Mozilla/5.0'}).text
soup = BeautifulSoup(html, 'html.parser')
script_urls = [s.get('src') for s in soup.find_all('script') if s.get('src')]
print('scripts', len(script_urls))
for s in script_urls[:20]:
    print(s)

candidates = [u for u in script_urls if 'listing' in u or 'chunks/pages' in u or '_next/static/chunks' in u]
print('candidate scripts', len(candidates))

patterns = [r'https?://[^"\']+', r'/api/[^"\']+', r'graphql[^"\']*', r'product[^"\']*list[^"\']*']

for cu in candidates[:5]:
    try:
        js = requests.get(cu, timeout=30, headers={'User-Agent':'Mozilla/5.0'}).text
        print('\n===', cu, 'len', len(js))
        for pat in patterns:
            found = re.findall(pat, js, flags=re.I)
            uniq = []
            for f in found:
                if f not in uniq:
                    uniq.append(f)
            print('pattern', pat, 'count', len(uniq))
            for x in uniq[:10]:
                print(' ', x[:200])
    except Exception as e:
        print('error', cu, e)
