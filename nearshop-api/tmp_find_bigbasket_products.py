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
driver.get('https://www.bigbasket.com/cl/fruits/6')
source = driver.page_source
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', source, re.S)
if not m:
    print('NO_NEXT_DATA')
    driver.quit()
    raise SystemExit(0)

data = json.loads(m.group(1))

def walk(node, path='root', depth=0):
    if depth > 8:
        return
    if isinstance(node, dict):
        keys_lower = [k.lower() for k in node.keys()]
        if any('product' in k for k in keys_lower):
            print('DICT_WITH_PRODUCT_KEY', path, list(node.keys())[:20])
        for k, v in node.items():
            walk(v, f'{path}.{k}', depth+1)
    elif isinstance(node, list):
        if node and isinstance(node[0], dict):
            ks = set()
            for item in node[:3]:
                ks.update(item.keys())
            keys_lower = [k.lower() for k in ks]
            if any('product' in k for k in keys_lower) or any('name' in k for k in keys_lower):
                print('LIST_DICT_PATH', path, 'len', len(node), 'keys', sorted(list(ks))[:30])
                # print sample
                sample = node[0]
                print('SAMPLE', {k: sample.get(k) for k in list(sample.keys())[:12]})
        for i, item in enumerate(node[:5]):
            walk(item, f'{path}[{i}]', depth+1)

walk(data)

driver.quit()
