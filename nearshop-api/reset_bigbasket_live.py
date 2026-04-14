#!/usr/bin/env python3
import asyncio
import os

import sqlalchemy as sa
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine


async def main() -> None:
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")

    engine = create_async_engine(db_url, echo=False)
    async with engine.begin() as conn:
        await conn.execute(sa.text("DELETE FROM catalog_templates WHERE data_source = 'bigbasket_live'"))
        rows = (
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

    await engine.dispose()

    print("SOURCE_COUNTS_AFTER_DELETE")
    if not rows:
        print("<empty>")
    for source, count in rows:
        print(f"{source}|{count}")


if __name__ == "__main__":
    asyncio.run(main())
