#!/usr/bin/env python3
"""Deep capture for JioMart network endpoints from browser session."""

import json
import time
from pathlib import Path

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

START_URL = "https://www.jiomart.com/c/groceries"
OUT_JSON = Path("docs/jiomart_deep_capture_report.json")


def main() -> None:
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
    opts.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

    report = {
        "start_url": START_URL,
        "api_candidates": [],
        "replay_results": [],
        "page_title": None,
        "page_url": None,
    }

    try:
        driver.get(START_URL)
        time.sleep(5)

        for _ in range(10):
            driver.execute_script("window.scrollBy(0, 900);")
            time.sleep(0.7)

        report["page_title"] = driver.title
        report["page_url"] = driver.current_url

        raw_logs = driver.get_log("performance")

        req_index = {}
        for item in raw_logs:
            try:
                msg = json.loads(item["message"])["message"]
                method = msg.get("method")
                params = msg.get("params", {})

                if method == "Network.requestWillBeSent":
                    req = params.get("request", {})
                    url = req.get("url", "")
                    rid = params.get("requestId")
                    if not rid or not url:
                        continue
                    req_index[rid] = {
                        "url": url,
                        "method": req.get("method"),
                        "resourceType": params.get("type"),
                        "hasPostData": bool(req.get("postData")),
                    }

                if method == "Network.responseReceived":
                    rid = params.get("requestId")
                    res = params.get("response", {})
                    if rid in req_index:
                        req_index[rid]["status"] = res.get("status")
                        req_index[rid]["mimeType"] = res.get("mimeType")
            except Exception:
                continue

        candidates = []
        for rec in req_index.values():
            url = (rec.get("url") or "").lower()
            if "jiomart" not in url:
                continue
            if any(k in url for k in ["api", "search", "category", "products", "listing", "graphql", "catalog"]):
                candidates.append(rec)

        # De-duplicate by URL and keep highest status seen
        best = {}
        for c in candidates:
            u = c["url"]
            if u not in best:
                best[u] = c
            else:
                prev = best[u].get("status", -1) or -1
                cur = c.get("status", -1) or -1
                if cur > prev:
                    best[u] = c

        report["api_candidates"] = sorted(best.values(), key=lambda x: (x.get("status", 0), x["url"]))

        # Build a requests session with copied cookies and replay GET candidates
        sess = requests.Session()
        sess.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://www.jiomart.com/",
            }
        )
        for c in driver.get_cookies():
            sess.cookies.set(c.get("name"), c.get("value", ""), domain=c.get("domain"))

        for c in report["api_candidates"][:20]:
            if c.get("method") != "GET":
                continue
            url = c["url"]
            try:
                r = sess.get(url, timeout=20)
                report["replay_results"].append(
                    {
                        "url": url,
                        "status": r.status_code,
                        "content_type": r.headers.get("content-type"),
                        "body_prefix": (r.text or "")[:180],
                    }
                )
            except Exception as exc:
                report["replay_results"].append({"url": url, "error": str(exc)})

    finally:
        driver.quit()

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"REPORT_FILE={OUT_JSON}")
    print(f"API_CANDIDATES={len(report['api_candidates'])}")
    print(f"REPLAYS={len(report['replay_results'])}")


if __name__ == "__main__":
    main()
