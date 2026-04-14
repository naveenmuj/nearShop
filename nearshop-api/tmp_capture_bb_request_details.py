import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

opts = Options()
opts.add_argument('--headless=new')
opts.add_argument('--disable-blink-features=AutomationControlled')
opts.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
opts.add_argument('--no-sandbox')
opts.add_argument('--disable-dev-shm-usage')
opts.set_capability('goog:loggingPrefs', {'performance': 'ALL'})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
driver.get('https://www.bigbasket.com/cl/fruits/6')
for _ in range(4):
    driver.execute_script('window.scrollBy(0, 800);')

logs = driver.get_log('performance')
for item in logs:
    try:
        msg = json.loads(item['message'])['message']
        if msg.get('method') == 'Network.requestWillBeSent':
            req = msg.get('params', {}).get('request', {})
            url = req.get('url', '')
            if 'listing-svc' in url:
                print('URL:', url)
                print('METHOD:', req.get('method'))
                h = req.get('headers', {})
                wanted = ['Referer', 'User-Agent', 'Cookie', 'mid', 'addressid', 'x-csrf-token', 'x-app-client']
                for k,v in h.items():
                    lk = k.lower()
                    if any(w.lower() in lk for w in wanted):
                        print(f'HEADER {k}: {v}')
                if req.get('postData'):
                    print('POSTDATA', req.get('postData')[:500])
                print('-' * 80)
    except Exception:
        continue

driver.quit()
