#!/usr/bin/env python3
"""Run live store collection and persist products into catalog_templates.

This script uses live BigBasket APIs discovered from browser traffic and records
category-level fetch status, saved rows, and sample products into a JSON report.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, UTC
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests
import sqlalchemy as sa
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from webdriver_manager.chrome import ChromeDriverManager

from app.core.storage import upload_remote_file

load_dotenv()

BIGBASKET_HOME = "https://www.bigbasket.com/"
BIGBASKET_CATEGORY_TREE = "https://www.bigbasket.com/ui-svc/v1/category-tree"
BIGBASKET_LISTING = "https://www.bigbasket.com/listing-svc/v2/products"
BIGBASKET_FALLBACK_CATEGORIES = [
    ("electronics", "Electronics", 0),
    ("audio-devices", "Audio devices", 1),
    ("cameras-accessories", "Cameras & Accessories", 1),
    ("electrical-accessories", "Electrical Accessories", 1),
    ("home-appliances", "Home Appliances", 1),
    ("kitchen-appliances", "Kitchen Appliances", 1),
    ("personal-care-grooming", "Personal Care & Grooming", 1),
    ("phone-laptop-accessory", "Phone & Laptop Accessory", 1),
]

JIOMART_CATEGORY_URLS = {
    "groceries": "https://www.jiomart.com/c/groceries",
    "fresh": "https://www.jiomart.com/c/fresh",
    "electronics": "https://www.jiomart.com/c/electronics",
    "fashion": "https://www.jiomart.com/c/fashion",
}


@dataclass
class CategoryFetchResult:
    source: str
    category: str
    status: str
    product_count: int
    reason: str = ""


class BigBasketLiveCollector:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "application/json,text/plain,*/*",
                "Referer": BIGBASKET_HOME,
            }
        )

    def bootstrap_cookie_session(self) -> None:
        """Create a browser session once and copy cookies to requests."""
        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )

        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
        try:
            driver.get(BIGBASKET_HOME)
            cookies = driver.get_cookies()
            for c in cookies:
                self.session.cookies.set(c["name"], c.get("value", ""), domain=".bigbasket.com")
        finally:
            driver.quit()

    def fetch_category_tree(self) -> List[Dict[str, Any]]:
        resp = self.session.get(BIGBASKET_CATEGORY_TREE, timeout=30)
        if resp.status_code >= 400:
            return []
        payload = resp.json()
        return payload.get("categories", [])

    def flatten_categories(self, nodes: List[Dict[str, Any]], max_depth: int = 1) -> List[Tuple[str, str, int]]:
        out: List[Tuple[str, str, int]] = []

        def walk(items: List[Dict[str, Any]], depth: int) -> None:
            for item in items:
                slug = item.get("slug")
                name = item.get("name")
                if slug and name and depth <= max_depth:
                    out.append((slug, name, depth))
                children = item.get("children") or []
                if children and depth < max_depth:
                    walk(children, depth + 1)

        walk(nodes, 0)

        uniq: List[Tuple[str, str, int]] = []
        seen = set()
        for slug, name, depth in out:
            if slug in seen:
                continue
            seen.add(slug)
            uniq.append((slug, name, depth))
        return uniq

    @staticmethod
    def _first_image_url(images: Any) -> str | None:
        if isinstance(images, list):
            for item in images:
                if isinstance(item, str) and item.startswith("http"):
                    return item
                if isinstance(item, dict):
                    for v in item.values():
                        if isinstance(v, str) and v.startswith("http"):
                            return v
        if isinstance(images, dict):
            for v in images.values():
                if isinstance(v, str) and v.startswith("http"):
                    return v
                if isinstance(v, list):
                    for x in v:
                        if isinstance(x, str) and x.startswith("http"):
                            return x
        return None

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(str(value).replace(",", "").strip())
        except Exception:
            return None

    def fetch_listing_page(self, slug: str, page: int = 1) -> Dict[str, Any]:
        params = {"type": "pc", "slug": slug, "page": page}
        resp = self.session.get(BIGBASKET_LISTING, params=params, timeout=30)
        if resp.status_code == 204:
            return {"products": [], "raw": {"status": 204}}
        if resp.status_code == 429:
            return {"products": [], "raw": {"status": 429, "reason": "rate_limited"}}
        if resp.status_code >= 400:
            return {"products": [], "raw": {"status": resp.status_code, "reason": "http_error"}}
        raw = resp.json()

        products = []
        tabs = raw.get("tabs") or []
        if tabs:
            info = tabs[0].get("product_info") or {}
            products = info.get("products") or []

        return {"products": products, "raw": raw}

    def normalize_products(self, products: List[Dict[str, Any]], category_name: str, slug: str) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for p in products:
            pid = str(p.get("id") or "")
            if not pid:
                continue

            pricing = p.get("pricing") or {}
            discount = pricing.get("discount") or {}
            prim_price = discount.get("prim_price") or {}
            rating = p.get("rating_info") or {}
            brand = p.get("brand") or {}

            sale_price = self._to_float(prim_price.get("sp"))
            compare_price = self._to_float(discount.get("mrp"))
            if sale_price is None:
                continue

            rating_value = self._to_float(rating.get("avg_rating"))
            reviews = rating.get("review_count")
            try:
                review_count = int(reviews) if reviews is not None else 0
            except Exception:
                review_count = 0

            discount_pct = None
            if compare_price and compare_price > 0 and sale_price <= compare_price:
                discount_pct = ((compare_price - sale_price) / compare_price) * 100

            name = p.get("desc") or p.get("name") or f"BigBasket Product {pid}"
            absolute_url = p.get("absolute_url") or ""
            source_url = (
                f"https://www.bigbasket.com{absolute_url}"
                if absolute_url.startswith("/")
                else BIGBASKET_HOME
            )

            normalized.append(
                {
                    "sku": f"bb-live-{pid}",
                    "name": name,
                    "brand": (brand.get("name") if isinstance(brand, dict) else None) or "BigBasket",
                    "category": category_name,
                    "subcategory": slug,
                    "description": name,
                    "thumbnail_url": self._first_image_url(p.get("images")),
                    "source_url": source_url,
                    "source_id": pid,
                    "data_source": "bigbasket_live",
                    "avg_rating": rating_value,
                    "num_reviews": review_count,
                    "base_price_inr": sale_price,
                    "compare_price_inr": compare_price,
                    "typical_discount_pct": discount_pct,
                    "confidence_score": 0.93,
                }
            )

        return normalized


def deduplicate_products(products: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
    """Drop duplicate products within the same run based on SKU/source_id/source_url."""
    deduped: List[Dict[str, Any]] = []
    seen_keys = set()
    duplicate_count = 0

    for p in products:
        key = (
            p.get("sku") or "",
            p.get("source_id") or "",
            p.get("source_url") or "",
        )
        if key in seen_keys:
            duplicate_count += 1
            continue
        seen_keys.add(key)
        deduped.append(p)

    return deduped, duplicate_count


def _safe_product_segment(value: str | None, fallback: str) -> str:
    raw = (value or fallback).strip().lower().replace(" ", "-")
    cleaned = "".join(ch for ch in raw if ch.isalnum() or ch in {"-", "_", "."})
    return cleaned or fallback


def upload_product_images(products: List[Dict[str, Any]]) -> Dict[str, int]:
    """Upload product images to configured object storage and map DB URLs to stored URLs."""
    uploaded = 0
    failed = 0
    skipped = 0

    for p in products:
        source_thumb = p.get("thumbnail_url")
        if not source_thumb:
            skipped += 1
            continue

        try:
            sku = _safe_product_segment(p.get("sku"), "unknown-sku")
            source_id = _safe_product_segment(p.get("source_id"), sku)
            obj = upload_remote_file(
                source_thumb,
                folder="products",
                entity_type="product",
                entity_id=source_id,
                product_id=source_id,
                purpose="image",
            )
            p["thumbnail_url"] = obj.url
            p["image_urls"] = [obj.url]
            uploaded += 1
        except Exception:
            failed += 1

    return {"uploaded": uploaded, "failed": failed, "skipped": skipped}


async def upsert_products(products: List[Dict[str, Any]]) -> Dict[str, int]:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")

    engine = create_async_engine(db_url, echo=False)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    inserted = 0
    duplicates_skipped = 0
    errors = 0

    query = sa.text(
        """
        INSERT INTO catalog_templates (
            sku, name, brand, category, subcategory,
            description, thumbnail_url, source_url, source_id,
            image_urls,
            data_source, avg_rating, num_reviews, confidence_score,
            popularity_score, num_shops_using,
            base_price_inr, compare_price_inr, typical_discount_pct,
            is_active, is_verified, last_scraped_at, created_at, updated_at
        ) VALUES (
            :sku, :name, :brand, :category, :subcategory,
            :description, :thumbnail_url, :source_url, :source_id,
            :image_urls,
            :data_source, :avg_rating, :num_reviews, :confidence_score,
            :popularity_score, :num_shops_using,
            :base_price_inr, :compare_price_inr, :typical_discount_pct,
            :is_active, :is_verified, :last_scraped_at, :created_at, :updated_at
        )
        ON CONFLICT (sku)
        DO NOTHING
        """
    )

    async with session_maker() as session:
        for p in products:
            now = datetime.now(UTC).replace(tzinfo=None)
            params = {
                **p,
                "popularity_score": 0.5,
                "num_shops_using": 0,
                "is_active": True,
                "is_verified": True,
                "image_urls": p.get("image_urls") or None,
                "last_scraped_at": now,
                "created_at": now,
                "updated_at": now,
            }
            try:
                res = await session.execute(query, params)
                if res.rowcount == 1:
                    inserted += 1
                else:
                    duplicates_skipped += 1
            except Exception:
                errors += 1
        await session.commit()

    await engine.dispose()
    return {"inserted": inserted, "duplicates_skipped": duplicates_skipped, "errors": errors}


def run_live_collection(
    max_categories: int = 0,
    delay_seconds: float = 0.8,
    max_pages_per_category: int = 0,
) -> Dict[str, Any]:
    collector = BigBasketLiveCollector()
    collector.bootstrap_cookie_session()

    report: Dict[str, Any] = {
        "timestamp_utc": datetime.now(UTC).isoformat(),
        "source": "bigbasket_live",
        "max_categories_requested": max_categories,
        "max_pages_per_category": max_pages_per_category,
        "category_results": [],
        "total_products_fetched": 0,
        "products": [],
        "jiomart_status": [],
    }

    tree = collector.fetch_category_tree()
    flattened = collector.flatten_categories(tree, max_depth=1)

    if not flattened:
        selected = BIGBASKET_FALLBACK_CATEGORIES[:max_categories] if max_categories > 0 else BIGBASKET_FALLBACK_CATEGORIES
    else:
        selected = flattened[:max_categories] if max_categories > 0 else flattened

    all_products: List[Dict[str, Any]] = []
    for slug, name, _depth in selected:
        category_total = 0
        category_status = "fetched"
        category_reason = ""

        first_result = collector.fetch_listing_page(slug, page=1)
        first_raw = first_result.get("raw", {})

        if first_raw.get("status") == 429:
            report["category_results"].append(
                CategoryFetchResult("bigbasket", name, "rate_limited", 0, "HTTP 429").__dict__
            )
            break

        if first_raw.get("status") == 204:
            report["category_results"].append(
                CategoryFetchResult("bigbasket", name, "no_content", 0, "HTTP 204").__dict__
            )
            time.sleep(delay_seconds)
            continue

        if first_raw.get("status") and first_raw.get("status") >= 400:
            report["category_results"].append(
                CategoryFetchResult("bigbasket", name, "error", 0, f"HTTP {first_raw.get('status')}").__dict__
            )
            time.sleep(delay_seconds)
            continue

        first_products = first_result.get("products", [])
        first_normalized = collector.normalize_products(first_products, name, slug)
        all_products.extend(first_normalized)
        category_total += len(first_normalized)

        pages = 1
        tabs = first_raw.get("tabs") or []
        if tabs:
            info = tabs[0].get("product_info") or {}
            try:
                pages = int(info.get("number_of_pages") or 1)
            except Exception:
                pages = 1

        if max_pages_per_category > 0:
            pages = min(pages, max_pages_per_category)

        for page in range(2, pages + 1):
            page_result = collector.fetch_listing_page(slug, page=page)
            page_raw = page_result.get("raw", {})

            if page_raw.get("status") == 429:
                category_status = "partial_rate_limited"
                category_reason = f"HTTP 429 at page {page}"
                break

            if page_raw.get("status") == 204:
                continue

            if page_raw.get("status") and page_raw.get("status") >= 400:
                category_status = "partial_error"
                category_reason = f"HTTP {page_raw.get('status')} at page {page}"
                break

            page_products = page_result.get("products", [])
            page_normalized = collector.normalize_products(page_products, name, slug)
            all_products.extend(page_normalized)
            category_total += len(page_normalized)
            time.sleep(delay_seconds)

        report["category_results"].append(
            CategoryFetchResult("bigbasket", name, category_status, category_total, category_reason).__dict__
        )
        time.sleep(delay_seconds)

    report["products"] = all_products
    report["total_products_fetched"] = len(all_products)

    # JioMart live probe status
    probe_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    for cat, url in JIOMART_CATEGORY_URLS.items():
        try:
            resp = requests.get(url, headers=probe_headers, timeout=20)
            status = "reachable" if resp.status_code == 200 else "blocked"
            reason = f"HTTP {resp.status_code}"
            report["jiomart_status"].append(
                CategoryFetchResult("jiomart", cat, status, 0, reason).__dict__
            )
        except Exception as exc:
            report["jiomart_status"].append(
                CategoryFetchResult("jiomart", cat, "error", 0, str(exc)).__dict__
            )

    return report


async def main() -> None:
    max_categories = int(os.getenv("LIVE_MAX_CATEGORIES", "0"))
    max_pages_per_category = int(os.getenv("LIVE_MAX_PAGES_PER_CATEGORY", "0"))
    delay_seconds = float(os.getenv("LIVE_CATEGORY_DELAY", "0.8"))
    upload_images = os.getenv("LIVE_UPLOAD_IMAGES", "true").lower() in {"1", "true", "yes", "y"}

    report = run_live_collection(
        max_categories=max_categories,
        delay_seconds=delay_seconds,
        max_pages_per_category=max_pages_per_category,
    )

    deduped, duplicates_dropped_in_run = deduplicate_products(report.get("products", []))
    report["duplicates_dropped_in_run"] = duplicates_dropped_in_run
    report["products_after_dedupe"] = len(deduped)

    image_result = {"uploaded": 0, "failed": 0, "skipped": 0, "enabled": upload_images}
    if upload_images and deduped:
        image_result = upload_product_images(deduped)
    report["image_upload_result"] = image_result

    db_result = {"inserted": 0, "duplicates_skipped": 0, "errors": 0}
    if deduped:
        db_result = await upsert_products(deduped)

    report["db_result"] = db_result
    report["sample_products"] = deduped[:25]
    report.pop("products", None)

    out_path = Path("docs") / "live_store_collection_report.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"REPORT_FILE={out_path}")
    print(f"TOTAL_FETCHED={report['total_products_fetched']}")
    print(f"DB_INSERTED={db_result['inserted']}")
    print(f"DB_DUPLICATES_SKIPPED={db_result['duplicates_skipped']}")
    print(f"IMAGE_UPLOADED={image_result['uploaded']}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
