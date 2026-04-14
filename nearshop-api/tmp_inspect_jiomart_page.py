import json
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

opts = Options()
opts.add_argument('--headless=new')
opts.add_argument('--disable-blink-features=AutomationControlled')
opts.add_argument('--no-sandbox')
opts.add_argument('--disable-dev-shm-usage')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
try:
    driver.get('https://www.jiomart.com/c/groceries')
    html = driver.page_source
    print('len', len(html))
    for pat in ['__NEXT_DATA__', 'product', 'sku', 'price', 'api', 'graphql', 'window.__']:
        print(pat, pat in html)

    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
    print('next_data', bool(m))
    if m:
        data = json.loads(m.group(1))
        print('top_keys', list(data.keys())[:10])
        print('page', data.get('page'))
        blob = json.dumps(data)[:2000]
        print('sample', blob)

    # Print any inline JSON script hints
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, flags=re.DOTALL)
    hits = 0
    for s in scripts:
        if 'product' in s.lower() and len(s) > 200:
            print('SCRIPT_HIT', s[:500])
            hits += 1
            if hits >= 3:
                break
finally:
    driver.quit()
