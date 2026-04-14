from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
import re
import json

opts = Options()
opts.add_argument('--headless=new')
opts.add_argument('--disable-blink-features=AutomationControlled')
opts.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
opts.add_argument('--no-sandbox')
opts.add_argument('--disable-dev-shm-usage')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

# BigBasket
url = 'https://www.bigbasket.com/cl/fruits/6'
driver.get(url)
source = driver.page_source
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', source, re.S)
print('BIGBASKET')
if m:
    data = json.loads(m.group(1))
    print('next_data keys', list(data.keys()))
    props = data.get('props', {})
    print('props keys', list(props.keys()))
    page_props = props.get('pageProps', {})
    print('pageProps keys sample', list(page_props.keys())[:20])
    text = json.dumps(page_props)[:2500]
    print('contains products?', 'product' in text.lower())
    print('snippet', text[:800])

print('\nJIOMART')
url = 'https://www.jiomart.com/c/groceries'
driver.get(url)
source = driver.page_source
# print likely window payload markers
markers = ['__NEXT_DATA__', '__INITIAL_STATE__', '__NUXT__', 'window.__', 'application/json']
for mk in markers:
    print(mk, mk in source)

for pat in [r'window\.__[A-Za-z0-9_]+\s*=\s*\{', r'<script[^>]*application/json[^>]*>']:
    found = re.findall(pat, source)
    print('pattern', pat, 'count', len(found))

print('first window.__ marker index', source.find('window.__'))
idx = source.find('window.__')
if idx != -1:
    print(source[idx:idx+500])

driver.quit()
