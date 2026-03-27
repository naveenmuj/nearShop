import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import app.auth.models  # noqa: F401
import app.deals.models  # noqa: F401
import app.delivery.models  # noqa: F401
import app.orders.models  # noqa: F401
import app.reviews.models  # noqa: F401
import app.stories.models  # noqa: F401

from app.admin.ranking_config import promote_ranking_experiment_winner
from app.admin.ranking_outcomes import get_ranking_outcomes
from app.config import get_settings
from app.core.database import async_session_factory


REPORT_PATH = Path(__file__).resolve().parents[2] / "docs" / "ranking_experiment_ops_report.json"


async def main() -> None:
    settings = get_settings()
    async with async_session_factory() as db:
        outcomes = await get_ranking_outcomes(db, "30d")

    promotions = []
    for experiment in outcomes.get("experiments", []) or []:
        recommendation = experiment.get("recommendation") or {}
        if (
            settings.RANKING_AUTO_PROMOTE_ENABLED
            and recommendation.get("status") == "ready_to_promote"
            and recommendation.get("winner_variant_id")
        ):
            promote_ranking_experiment_winner(
                experiment["surface"],
                experiment["experiment_id"],
                recommendation["winner_variant_id"],
            )
            promotions.append(
                {
                    "surface": experiment["surface"],
                    "experiment_id": experiment["experiment_id"],
                    "winner_profile_id": recommendation["winner_variant_id"],
                }
            )

    report = {
        "generated_at": outcomes.get("generated_at"),
        "period": outcomes.get("period"),
        "auto_promote_enabled": settings.RANKING_AUTO_PROMOTE_ENABLED,
        "ready_to_promote_count": sum(
            1
            for experiment in (outcomes.get("experiments") or [])
            if (experiment.get("recommendation") or {}).get("status") == "ready_to_promote"
        ),
        "promotions_applied": promotions,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"report_path={REPORT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
