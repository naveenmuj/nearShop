#!/usr/bin/env python3
"""Generate summary reports for live scraped store data."""

import asyncio
import json
import os
from datetime import datetime, UTC
from pathlib import Path

import sqlalchemy as sa
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine


async def main() -> None:
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")

    report_path = Path("docs/live_store_collection_report.json")
    if not report_path.exists():
        raise RuntimeError("Run collect_live_store_data.py first")

    live_report = json.loads(report_path.read_text(encoding="utf-8"))

    engine = create_async_engine(db_url, echo=False)
    async with engine.begin() as conn:
        source_rows = (
            await conn.execute(
                sa.text(
                    """
                    SELECT data_source, COUNT(*)
                    FROM catalog_templates
                    GROUP BY data_source
                    ORDER BY COUNT(*) DESC
                    """
                )
            )
        ).all()

        bigbasket_rows = (
            await conn.execute(
                sa.text(
                    """
                    SELECT category, COUNT(*),
                           MIN(base_price_inr), MAX(base_price_inr),
                           ROUND(AVG(base_price_inr)::numeric, 2)
                    FROM catalog_templates
                    WHERE data_source = 'bigbasket_live'
                    GROUP BY category
                    ORDER BY COUNT(*) DESC
                    """
                )
            )
        ).all()

        sample_rows = (
            await conn.execute(
                sa.text(
                    """
                    SELECT name, brand, category, base_price_inr, compare_price_inr,
                           avg_rating, num_reviews, source_url
                    FROM catalog_templates
                    WHERE data_source = 'bigbasket_live'
                    ORDER BY updated_at DESC
                    LIMIT 20
                    """
                )
            )
        ).all()

    await engine.dispose()

    out = {
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "live_scrape_report": live_report,
        "db_source_counts": [
            {"source": r[0], "count": int(r[1])} for r in source_rows
        ],
        "bigbasket_live_category_stats": [
            {
                "category": r[0],
                "count": int(r[1]),
                "min_price": float(r[2]) if r[2] is not None else None,
                "max_price": float(r[3]) if r[3] is not None else None,
                "avg_price": float(r[4]) if r[4] is not None else None,
            }
            for r in bigbasket_rows
        ],
        "bigbasket_live_samples": [
            {
                "name": r[0],
                "brand": r[1],
                "category": r[2],
                "price": float(r[3]) if r[3] is not None else None,
                "compare_price": float(r[4]) if r[4] is not None else None,
                "avg_rating": float(r[5]) if r[5] is not None else None,
                "num_reviews": int(r[6]) if r[6] is not None else 0,
                "source_url": r[7],
            }
            for r in sample_rows
        ],
    }

    json_out = Path("docs/live_store_collection_summary.json")
    json_out.write_text(json.dumps(out, indent=2), encoding="utf-8")

    md_lines = []
    md_lines.append("# Live Scrape Summary")
    md_lines.append("")
    md_lines.append(f"Generated: {out['generated_at_utc']}")
    md_lines.append("")
    md_lines.append("## Real Run Outcome")
    md_lines.append(f"- Total fetched: {live_report.get('total_products_fetched', 0)}")
    db_result = live_report.get("db_result", {})
    md_lines.append(f"- DB upserted: {db_result.get('inserted_or_updated', 0)}")
    md_lines.append(f"- DB errors: {db_result.get('errors', 0)}")
    md_lines.append("")
    md_lines.append("## BigBasket Category Fetch Status")
    for row in live_report.get("category_results", []):
        md_lines.append(
            f"- {row.get('category')}: {row.get('status')} ({row.get('product_count')} products)"
        )
    md_lines.append("")
    md_lines.append("## JioMart Status")
    for row in live_report.get("jiomart_status", []):
        md_lines.append(
            f"- {row.get('category')}: {row.get('status')} ({row.get('reason')})"
        )
    md_lines.append("")
    md_lines.append("## DB Source Counts")
    for row in out["db_source_counts"]:
        md_lines.append(f"- {row['source']}: {row['count']}")
    md_lines.append("")
    md_lines.append("## BigBasket Live Categories in DB")
    for row in out["bigbasket_live_category_stats"]:
        md_lines.append(
            f"- {row['category']}: {row['count']} | min {row['min_price']} | max {row['max_price']} | avg {row['avg_price']}"
        )

    md_out = Path("docs/live_store_collection_summary.md")
    md_out.write_text("\n".join(md_lines), encoding="utf-8")

    print(f"JSON_REPORT={json_out}")
    print(f"MD_REPORT={md_out}")


if __name__ == "__main__":
    asyncio.run(main())
