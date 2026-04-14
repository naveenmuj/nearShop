import requests
import re
from bs4 import BeautifulSoup

html = requests.get('https://www.bigbasket.com/cl/fruits/6', timeout=30, headers={'User-Agent':'Mozilla/5.0'}).text
soup = BeautifulSoup(html, 'html.parser')
script_urls = [s.get('src') for s in soup.find_all('script') if s.get('src') and 'bbassets.com/monsters-inc/static/_next/static/chunks' in s.get('src')]

for u in script_urls:
    try:
        js = requests.get(u, timeout=30, headers={'User-Agent':'Mozilla/5.0'}).text
    except Exception:
        continue
    if 'getListingQuery' in js or 'listing-svc/v2/products' in js or 'AddressId' in js or 'lat-long' in js or 'mid=' in js:
        print('\n===', u)
        for token in ['getListingQuery', 'listing-svc/v2/products', 'AddressId', 'addressId', 'mid', 'lat', 'lng', 'longitude', 'location']:
            i = js.find(token)
            if i != -1:
                print('token', token, 'idx', i)
                print(js[max(0, i-180):i+280])
        
