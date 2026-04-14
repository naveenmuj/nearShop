#!/usr/bin/env python3
"""Browser-only JioMart extractor.

Uses Selenium-rendered DOM extraction only (no direct API replay).
"""

from __future__ import annotations

import json
import re
import os
import time
from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path
from typing import Any, Dict, List

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

JIOMART_CATEGORY_URLS = {
    "groceries": "https://www.jiomart.com/c/groceries",
    "fresh": "https://www.jiomart.com/c/fresh",
    "electronics": "https://www.jiomart.com/c/electronics",
    "fashion": "https://www.jiomart.com/c/fashion",
}

OUT_REPORT = Path("docs/jiomart_browser_extract_report.json")
DEFAULT_CHROME_USER_DATA_DIR = Path(os.getenv("LOCALAPPDATA", "")) / "Google" / "Chrome" / "User Data"
WORKSPACE_CHROME_PROFILE_DIR = Path(".jiomart-profile")


@dataclass
class CategoryResult:
    category: str
    url: str
    status: str
    product_count: int
    reason: str = ""


def _parse_price(text: str | None) -> float | None:
    if not text:
        return None
    m = re.search(r"([\d,]+(?:\.\d+)?)", text.replace("₹", "").replace("Rs", ""))
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except Exception:
        return None


def _extract_products_from_html(html: str, base_url: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    products: List[Dict[str, Any]] = []

    # Generic and resilient selectors.
    cards = soup.select("a[href*='/p/'], div[class*='product'], li[class*='product']")

    seen = set()
    for card in cards:
        try:
            link = card if card.name == "a" else card.find("a", href=True)
            href = link.get("href") if link else None
            if not href:
                continue

            if href.startswith("/"):
                source_url = f"https://www.jiomart.com{href}"
            elif href.startswith("http"):
                source_url = href
            else:
                continue

            if "/p/" not in source_url:
                continue

            name = None
            for sel in [
                "h2",
                "h3",
                "h4",
                "span[class*='name']",
                "div[class*='name']",
                "div[class*='title']",
            ]:
                node = card.select_one(sel)
                if node and node.get_text(strip=True):
                    name = node.get_text(" ", strip=True)
                    break

            if not name and link and link.get("title"):
                name = link.get("title").strip()

            if not name:
                continue

            price = None
            for sel in [
                "span[class*='price']",
                "div[class*='price']",
                "span",
                "div",
            ]:
                for node in card.select(sel):
                    txt = node.get_text(" ", strip=True)
                    if "₹" in txt or "Rs" in txt:
                        price = _parse_price(txt)
                        if price:
                            break
                if price:
                    break

            img = card.find("img")
            thumb = None
            if img:
                thumb = img.get("src") or img.get("data-src")

            sku = re.sub(r"[^a-z0-9-]", "-", name.lower()).strip("-")[:70]
            key = (sku, source_url)
            if key in seen:
                continue
            seen.add(key)

            products.append(
                {
                    "sku": f"jiomart-browser-{sku}",
                    "name": name,
                    "price": price,
                    "thumbnail_url": thumb,
                    "source_url": source_url,
                    "data_source": "jiomart_browser",
                }
            )
        except Exception:
            continue

    return products


def _chrome_profile_args(opts: Options) -> None:
    """Attach a persistent Chrome profile if configured."""
    user_data_dir = os.getenv("JIOMART_CHROME_USER_DATA_DIR")
    profile_dir = os.getenv("JIOMART_CHROME_PROFILE_DIR")
    use_headless = os.getenv("JIOMART_HEADLESS", "false").lower() in {"1", "true", "yes", "y"}

    if user_data_dir:
        opts.add_argument(f"--user-data-dir={user_data_dir}")
    else:
        opts.add_argument(f"--user-data-dir={WORKSPACE_CHROME_PROFILE_DIR.resolve()}")

    if profile_dir:
        opts.add_argument(f"--profile-directory={profile_dir}")
    elif DEFAULT_CHROME_USER_DATA_DIR.exists():
        # When copying a live Chrome profile, profile selection is still useful.
        opts.add_argument("--profile-directory=Default")

    if use_headless:
        opts.add_argument("--headless=new")


def run_browser_extract(scroll_steps: int = 12, wait_s: float = 0.8) -> Dict[str, Any]:
    opts = Options()
    _chrome_profile_args(opts)
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

    report: Dict[str, Any] = {
        "timestamp_utc": datetime.now(UTC).isoformat(),
        "mode": "browser-only-dom-extract",
        "categories": [],
        "total_products": 0,
        "sample_products": [],
    }

    all_products: List[Dict[str, Any]] = []

    try:
        bootstrap_url = os.getenv("JIOMART_BOOTSTRAP_URL", "https://www.jiomart.com/")
        driver.get(bootstrap_url)
        time.sleep(float(os.getenv("JIOMART_BOOTSTRAP_WAIT", "8")))

        for category, url in JIOMART_CATEGORY_URLS.items():
            try:
                driver.get(url)
                time.sleep(float(os.getenv("JIOMART_PAGE_WAIT", "5")))
                for _ in range(scroll_steps):
                    driver.execute_script("window.scrollBy(0, 900);")
                    time.sleep(wait_s)

                html = driver.page_source or ""
                title = driver.title or ""
                report.setdefault("page_context", {})[category] = {
                    "title": title,
                    "current_url": driver.current_url,
                }
                snap_path = Path("docs") / f"jiomart_{category}_snapshot.html"
                snap_path.parent.mkdir(parents=True, exist_ok=True)
                snap_path.write_text(html, encoding="utf-8")
                blocked = "access denied" in html.lower() or "access denied" in title.lower()

                if blocked:
                    report["categories"].append(
                        CategoryResult(category, url, "blocked", 0, "Access Denied page").__dict__
                    )
                    continue

                products = _extract_products_from_html(html, url)
                status = "fetched" if products else "no_products"
                reason = ""
                report["categories"].append(
                    CategoryResult(category, url, status, len(products), reason).__dict__
                )
                all_products.extend(products)

            except Exception as exc:
                report["categories"].append(
                    CategoryResult(category, url, "error", 0, str(exc)).__dict__
                )

    finally:
        driver.quit()

    report["total_products"] = len(all_products)
    report["sample_products"] = all_products[:25]
    return report


def main() -> None:
    report = run_browser_extract()
    OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    OUT_REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"REPORT_FILE={OUT_REPORT}")
    print(f"TOTAL_PRODUCTS={report['total_products']}")
    for c in report["categories"]:
        print(f"CAT={c['category']}|{c['status']}|{c['product_count']}|{c['reason']}")


if __name__ == "__main__":
    main()
