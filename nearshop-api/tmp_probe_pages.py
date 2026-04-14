from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
import re

opts = Options()
opts.add_argument('--headless=new')
opts.add_argument('--disable-blink-features=AutomationControlled')
opts.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
opts.add_argument('--no-sandbox')
opts.add_argument('--disable-dev-shm-usage')

urls = [
    'https://www.bigbasket.com/cl/fruits/6',
    'https://www.jiomart.com/c/groceries',
]

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

for url in urls:
    driver.get(url)
    source = driver.page_source
    print('URL', url)
    print('LEN', len(source))
    print('HAS_NEXT_DATA', '__NEXT_DATA__' in source)
    print('HAS_APPLICATION_LD_JSON', 'application/ld+json' in source)
    print('HAS_PRODUCT_WORD', bool(re.search(r'product', source, re.I)))

    next_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', source, re.S)
    print('NEXT_DATA_LEN', len(next_match.group(1)) if next_match else 0)

    ld_matches = re.findall(r'<script type="application/ld\+json">(.*?)</script>', source, re.S)
    print('LD_JSON_BLOCKS', len(ld_matches))
    print('-' * 60)

driver.quit()
