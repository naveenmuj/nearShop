#!/usr/bin/env python3
"""Validate duplicate prevention and image URL mapping for live scraped data."""

import asyncio
import json
import os
from pathlib import Path

import sqlalchemy as sa
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine

from collect_live_store_data import upsert_products


async def main() -> None:
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")

    report_path = Path("docs/live_store_collection_report.json")
    if not report_path.exists():
        raise RuntimeError("Run collect_live_store_data.py first")

    report = json.loads(report_path.read_text(encoding="utf-8"))
    samples = report.get("sample_products", [])[:10]

    dedup_test_result = await upsert_products(samples) if samples else {"inserted": 0, "duplicates_skipped": 0, "errors": 0}

    engine = create_async_engine(db_url, echo=False)
    async with engine.begin() as conn:
        source_count = (
            await conn.execute(
                sa.text("SELECT COUNT(*) FROM catalog_templates WHERE data_source='bigbasket_live'")
            )
        ).scalar_one()

        distinct_sku = (
            await conn.execute(
                sa.text("SELECT COUNT(DISTINCT sku) FROM catalog_templates WHERE data_source='bigbasket_live'")
            )
        ).scalar_one()

        mapped_thumb_count = (
            await conn.execute(
                sa.text(
                    """
                    SELECT COUNT(*) FROM catalog_templates
                    WHERE data_source='bigbasket_live'
                      AND thumbnail_url LIKE 'https://%.digitaloceanspaces.com/%'
                    """
                )
            )
        ).scalar_one()

        image_urls_count = (
            await conn.execute(
                sa.text(
                    """
                    SELECT COUNT(*) FROM catalog_templates
                    WHERE data_source='bigbasket_live' AND image_urls IS NOT NULL
                    """
                )
            )
        ).scalar_one()

        latest = (
            await conn.execute(
                sa.text(
                    """
                    SELECT sku, name, thumbnail_url, image_urls[1]
                    FROM catalog_templates
                    WHERE data_source='bigbasket_live'
                    ORDER BY updated_at DESC
                    LIMIT 5
                    """
                )
            )
        ).all()

    await engine.dispose()

    out = {
        "dedupe_reinsert_test": dedup_test_result,
        "db_checks": {
            "bigbasket_live_rows": int(source_count),
            "distinct_bigbasket_live_skus": int(distinct_sku),
            "mapped_thumbnail_digitalocean_count": int(mapped_thumb_count),
            "image_urls_present_count": int(image_urls_count),
        },
        "latest_examples": [
            {
                "sku": r[0],
                "name": r[1],
                "thumbnail_url": r[2],
                "image_url_1": r[3],
            }
            for r in latest
        ],
    }

    out_path = Path("docs/live_requirements_validation.json")
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")

    print(f"VALIDATION_FILE={out_path}")
    print(f"DEDUPE_INSERTED={dedup_test_result.get('inserted', 0)}")
    print(f"DEDUPE_SKIPPED={dedup_test_result.get('duplicates_skipped', 0)}")
    print(f"MAPPED_THUMBS={mapped_thumb_count}")


if __name__ == "__main__":
    asyncio.run(main())
