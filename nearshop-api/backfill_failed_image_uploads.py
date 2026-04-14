#!/usr/bin/env python3
import asyncio
import os
import sqlalchemy as sa
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.storage import upload_remote_file

load_dotenv()


def safe_segment(value: str, fallback: str) -> str:
    raw = (value or fallback).strip().lower().replace(" ", "-")
    cleaned = "".join(ch for ch in raw if ch.isalnum() or ch in {"-", "_", "."})
    return cleaned or fallback


async def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")

    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        rows = (await conn.execute(sa.text("""
            SELECT id, sku, source_id, thumbnail_url
            FROM catalog_templates
            WHERE data_source='bigbasket_live'
              AND thumbnail_url LIKE 'https://www.bbassets.com/%'
            ORDER BY updated_at DESC
        """))).all()

        updated = 0
        failed = 0

        for row in rows:
            row_id, sku, source_id, source_thumb = row
            try:
                sid = safe_segment(str(source_id or sku or row_id), "unknown")
                obj = upload_remote_file(
                    source_thumb,
                    folder="products",
                    entity_type="product",
                    entity_id=sid,
                    product_id=sid,
                    purpose="image",
                )
                await conn.execute(sa.text("""
                    UPDATE catalog_templates
                    SET thumbnail_url = :thumb,
                        image_urls = ARRAY[:thumb]::VARCHAR[],
                        updated_at = NOW()
                    WHERE id = :id
                """), {"thumb": obj.url, "id": row_id})
                updated += 1
            except Exception:
                failed += 1

        print(f"TARGET_ROWS={len(rows)}")
        print(f"UPDATED={updated}")
        print(f"FAILED={failed}")

        verify = (await conn.execute(sa.text("""
            SELECT COUNT(*)
            FROM catalog_templates
            WHERE data_source='bigbasket_live'
              AND thumbnail_url LIKE 'https://%.digitaloceanspaces.com/%'
        """))).scalar_one()
        total = (await conn.execute(sa.text("""
            SELECT COUNT(*)
            FROM catalog_templates
            WHERE data_source='bigbasket_live'
        """))).scalar_one()

        print(f"SPACES_MAPPED={verify}")
        print(f"TOTAL_BIGBASKET={total}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
