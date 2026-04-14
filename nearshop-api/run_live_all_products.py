#!/usr/bin/env python3
"""Run full live scrape for available store sources and persist to DB."""

import asyncio
import json
from pathlib import Path

from collect_live_store_data import (
    deduplicate_products,
    run_live_collection,
    upload_product_images,
    upsert_products,
)


async def main() -> None:
    # Try full breadth: all discovered categories and all pages.
    report = run_live_collection(
        max_categories=0,
        delay_seconds=0.5,
        max_pages_per_category=0,
    )

    deduped, dupes = deduplicate_products(report.get("products", []))
    report["duplicates_dropped_in_run"] = dupes
    report["products_after_dedupe"] = len(deduped)

    image_result = upload_product_images(deduped) if deduped else {"uploaded": 0, "failed": 0, "skipped": 0}
    report["image_upload_result"] = image_result

    db_result = await upsert_products(deduped) if deduped else {"inserted": 0, "duplicates_skipped": 0, "errors": 0}
    report["db_result"] = db_result

    report["sample_products"] = deduped[:25]
    report.pop("products", None)

    out_path = Path("docs") / "live_store_collection_report.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"REPORT_FILE={out_path}")
    print(f"TOTAL_FETCHED={report.get('total_products_fetched', 0)}")
    print(f"TOTAL_AFTER_DEDUPE={report.get('products_after_dedupe', 0)}")
    print(f"DB_INSERTED={db_result.get('inserted', 0)}")
    print(f"DB_DUPLICATES_SKIPPED={db_result.get('duplicates_skipped', 0)}")
    print(f"IMAGE_UPLOADED={image_result.get('uploaded', 0)}")


if __name__ == "__main__":
    asyncio.run(main())
