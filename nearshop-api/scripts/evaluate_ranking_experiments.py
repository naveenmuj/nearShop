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

from app.admin.ranking_outcomes import get_ranking_outcomes
from app.core.database import async_session_factory


REPORT_PATH = Path(__file__).resolve().parents[2] / "docs" / "ranking_experiment_outcomes_report.json"


def _variant_score(variant: dict) -> tuple[float, float, int]:
    return (
        float(variant.get("purchase_rate", 0) or 0),
        float(variant.get("ctr", 0) or 0),
        int(variant.get("impressions", 0) or 0),
    )


async def main() -> None:
    async with async_session_factory() as db:
        outcomes = await get_ranking_outcomes(db, "30d")

    experiments = []
    for experiment in outcomes.get("experiments", []) or []:
        variants = experiment.get("variants", []) or []
        winner = max(variants, key=_variant_score) if variants else None
        experiments.append(
            {
                "experiment_id": experiment.get("experiment_id"),
                "surface": experiment.get("surface"),
                "impressions": experiment.get("impressions", 0),
                "ctr": experiment.get("ctr", 0),
                "purchase_rate": experiment.get("purchase_rate", 0),
                "variants": variants,
                "winner": winner,
                "recommendation": experiment.get("recommendation"),
            }
        )

    report = {
        "generated_at": outcomes.get("generated_at"),
        "period": outcomes.get("period"),
        "experiment_count": len(experiments),
        "ready_to_promote_count": sum(
            1 for experiment in experiments if (experiment.get("recommendation") or {}).get("status") == "ready_to_promote"
        ),
        "experiments": experiments,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"report_path={REPORT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
