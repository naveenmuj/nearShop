import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.admin.ranking_config import update_ranking_experiment


def main() -> None:
    config = update_ranking_experiment(
        "unified_search",
        "unified_search_live_v1",
        [
            {"profile_id": "query_focus_v1", "weight": 0.5},
            {"profile_id": "balanced_v1", "weight": 0.5},
        ],
    )
    print(json.dumps(config["surface_experiments"]["unified_search"], indent=2))


if __name__ == "__main__":
    main()
