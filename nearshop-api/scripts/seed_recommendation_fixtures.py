import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.database import async_session_factory
from app.ranking.demo_fixtures import ensure_recommendation_fixtures


async def main() -> None:
    async with async_session_factory() as db:
        payload = await ensure_recommendation_fixtures(db)
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
