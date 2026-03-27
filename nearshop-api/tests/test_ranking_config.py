import tempfile
import unittest
from pathlib import Path

from app.admin.ranking_config import update_ranking_experiment
from app.admin.ranking_config import promote_ranking_experiment_winner
from app.admin.ranking_config import get_ranking_history
from app.config import get_settings
from app.ranking.service import (
    get_surface_experiments,
    get_surface_profile_overrides,
    save_runtime_experiments,
    save_runtime_profile_overrides,
)


class RankingConfigTests(unittest.TestCase):
    def test_runtime_override_file_updates_surface_profiles(self):
        settings = get_settings()
        original_path = settings.RANKING_PROFILE_OVERRIDES_FILE
        with tempfile.TemporaryDirectory() as tmpdir:
            settings.RANKING_PROFILE_OVERRIDES_FILE = str(Path(tmpdir) / "ranking_profile_overrides.json")
            save_runtime_profile_overrides({"unified_search": "conversion_focus_v1"})
            overrides = get_surface_profile_overrides()
            self.assertEqual(overrides["unified_search"]["id"], "conversion_focus_v1")
            self.assertTrue(overrides["unified_search"]["overridden"])
        settings.RANKING_PROFILE_OVERRIDES_FILE = original_path

    def test_runtime_experiment_file_updates_surface_experiments(self):
        settings = get_settings()
        original_path = settings.RANKING_EXPERIMENTS_FILE
        with tempfile.TemporaryDirectory() as tmpdir:
            settings.RANKING_EXPERIMENTS_FILE = str(Path(tmpdir) / "ranking_experiments.json")
            save_runtime_experiments(
                {
                    "unified_search": {
                        "experiment_id": "search_exp_v1",
                        "variants": [
                            {"profile_id": "query_focus_v1", "weight": 0.5},
                            {"profile_id": "balanced_v1", "weight": 0.5},
                        ],
                    }
                }
            )
            experiments = get_surface_experiments()
            self.assertEqual(experiments["unified_search"]["experiment_id"], "search_exp_v1")
            self.assertEqual(len(experiments["unified_search"]["variants"]), 2)
        settings.RANKING_EXPERIMENTS_FILE = original_path

    def test_update_ranking_experiment_rejects_duplicate_profiles(self):
        with self.assertRaisesRegex(ValueError, "distinct profiles"):
            update_ranking_experiment(
                "unified_search",
                "search_exp_v1",
                [
                    {"profile_id": "query_focus_v1", "weight": 0.5},
                    {"profile_id": "query_focus_v1", "weight": 0.5},
                ],
            )

    def test_promote_ranking_experiment_winner_sets_override_and_clears_experiment(self):
        settings = get_settings()
        original_profile_path = settings.RANKING_PROFILE_OVERRIDES_FILE
        original_experiment_path = settings.RANKING_EXPERIMENTS_FILE
        original_history_path = settings.RANKING_HISTORY_FILE
        with tempfile.TemporaryDirectory() as tmpdir:
            settings.RANKING_PROFILE_OVERRIDES_FILE = str(Path(tmpdir) / "ranking_profile_overrides.json")
            settings.RANKING_EXPERIMENTS_FILE = str(Path(tmpdir) / "ranking_experiments.json")
            settings.RANKING_HISTORY_FILE = str(Path(tmpdir) / "ranking_history.json")
            save_runtime_experiments(
                {
                    "unified_search": {
                        "experiment_id": "search_exp_v1",
                        "variants": [
                            {"profile_id": "query_focus_v1", "weight": 0.5},
                            {"profile_id": "balanced_v1", "weight": 0.5},
                        ],
                    }
                }
            )
            config = promote_ranking_experiment_winner("unified_search", "search_exp_v1", "query_focus_v1")
            self.assertEqual(config["surface_profiles"]["unified_search"]["id"], "query_focus_v1")
            self.assertTrue(config["surface_profiles"]["unified_search"]["overridden"])
            self.assertNotIn("unified_search", config["surface_experiments"])
            history = get_ranking_history()
            self.assertEqual(history[0]["event_type"], "surface_experiment_promoted")
            self.assertEqual(history[0]["winner_profile_id"], "query_focus_v1")
        settings.RANKING_PROFILE_OVERRIDES_FILE = original_profile_path
        settings.RANKING_EXPERIMENTS_FILE = original_experiment_path
        settings.RANKING_HISTORY_FILE = original_history_path


if __name__ == "__main__":
    unittest.main()
