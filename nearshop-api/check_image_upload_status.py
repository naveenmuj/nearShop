#!/usr/bin/env python3
import asyncio
import os
import sqlalchemy as sa
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv()

async def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")

    engine = create_async_engine(db_url, echo=False)
    async with engine.begin() as conn:
        rows_total = (await conn.execute(sa.text("SELECT COUNT(*) FROM catalog_templates WHERE data_source='bigbasket_live'"))).scalar_one()
        rows_spaces = (await conn.execute(sa.text("""
            SELECT COUNT(*) FROM catalog_templates
            WHERE data_source='bigbasket_live'
              AND thumbnail_url LIKE 'https://%.digitaloceanspaces.com/%'
        """))).scalar_one()
        rows_bbassets = (await conn.execute(sa.text("""
            SELECT COUNT(*) FROM catalog_templates
            WHERE data_source='bigbasket_live'
              AND thumbnail_url LIKE 'https://www.bbassets.com/%'
        """))).scalar_one()
        rows_null = (await conn.execute(sa.text("""
            SELECT COUNT(*) FROM catalog_templates
            WHERE data_source='bigbasket_live'
              AND thumbnail_url IS NULL
        """))).scalar_one()
        rows_imgarr = (await conn.execute(sa.text("""
            SELECT COUNT(*) FROM catalog_templates
            WHERE data_source='bigbasket_live'
              AND image_urls IS NOT NULL
              AND array_length(image_urls, 1) > 0
        """))).scalar_one()

        print(f"TOTAL={rows_total}")
        print(f"SPACES_URLS={rows_spaces}")
        print(f"BBASSETS_URLS={rows_bbassets}")
        print(f"NULL_THUMBNAILS={rows_null}")
        print(f"IMAGE_ARRAY_PRESENT={rows_imgarr}")

        sample = (await conn.execute(sa.text("""
            SELECT sku, thumbnail_url
            FROM catalog_templates
            WHERE data_source='bigbasket_live'
            ORDER BY updated_at DESC
            LIMIT 10
        """))).all()
        for sku, url in sample:
            print(f"SAMPLE={sku}|{url}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
