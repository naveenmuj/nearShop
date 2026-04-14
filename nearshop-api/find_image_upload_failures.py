#!/usr/bin/env python3
import asyncio
import os
import sqlalchemy as sa
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv()

async def main():
    db_url = os.getenv("DATABASE_URL")
    engine = create_async_engine(db_url, echo=False)
    async with engine.begin() as conn:
        rows = (await conn.execute(sa.text("""
            SELECT sku, name, source_url, thumbnail_url
            FROM catalog_templates
            WHERE data_source='bigbasket_live'
              AND thumbnail_url LIKE 'https://www.bbassets.com/%'
            ORDER BY updated_at DESC
        """))).all()

        print(f"FAILED_COUNT={len(rows)}")
        for r in rows:
            print(f"SKU={r[0]}")
            print(f"NAME={r[1]}")
            print(f"SOURCE_URL={r[2]}")
            print(f"THUMBNAIL={r[3]}")
            print("---")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
