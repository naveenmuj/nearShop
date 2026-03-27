from datetime import datetime, timezone
import unittest

from app.admin.ranking_outcomes import summarize_ranking_outcomes


class RankingOutcomesSummaryTests(unittest.TestCase):
    def test_summarizes_surface_metrics(self):
        now = datetime(2026, 3, 27, tzinfo=timezone.utc)
        events = [
            {"event_type": "ranking_impression", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match", "ranking_profile": "balanced_v1", "ranking_experiment": "rec_exp_v1", "ranking_variant": "balanced_v1"}, "created_at": now},
            {"event_type": "ranking_impression", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match", "ranking_profile": "balanced_v1", "ranking_experiment": "rec_exp_v1", "ranking_variant": "balanced_v1"}, "created_at": now},
            {"event_type": "product_click", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match", "ranking_profile": "balanced_v1", "ranking_experiment": "rec_exp_v1", "ranking_variant": "balanced_v1"}, "created_at": now},
            {"event_type": "add_to_cart", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match", "ranking_profile": "balanced_v1", "ranking_experiment": "rec_exp_v1", "ranking_variant": "balanced_v1"}, "created_at": now},
            {"event_type": "purchase", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match", "ranking_profile": "balanced_v1", "ranking_experiment": "rec_exp_v1", "ranking_variant": "balanced_v1"}, "created_at": now},
            {"event_type": "ranking_impression", "metadata": {"ranking_surface": "unified_search", "ranking_reason": "query_match", "ranking_profile": "query_focus_v1", "ranking_experiment": "search_exp_v2", "ranking_variant": "query_focus_v1"}, "created_at": now},
            {"event_type": "product_click", "metadata": {"ranking_surface": "unified_search", "ranking_reason": "query_match", "ranking_profile": "query_focus_v1", "ranking_experiment": "search_exp_v2", "ranking_variant": "query_focus_v1"}, "created_at": now},
        ]

        summary = summarize_ranking_outcomes(events, now=now)

        self.assertEqual(summary["summary"]["impressions"], 3)
        self.assertEqual(summary["summary"]["clicks"], 2)
        self.assertEqual(summary["summary"]["purchases"], 1)
        self.assertEqual(summary["summary"]["best_surface"], "content_recommendations")

        content = next(item for item in summary["surfaces"] if item["surface"] == "content_recommendations")
        self.assertEqual(content["impressions"], 2)
        self.assertEqual(content["clicks"], 1)
        self.assertEqual(content["add_to_carts"], 1)
        self.assertEqual(content["purchases"], 1)
        self.assertEqual(content["ctr"], 50.0)
        self.assertEqual(content["purchase_rate"], 50.0)
        self.assertEqual(content["top_reasons"][0]["reason"], "ai_match")
        self.assertEqual(summary["summary"]["profile_count"], 2)
        self.assertEqual(summary["summary"]["experiment_count"], 2)
        query_profile = next(item for item in summary["profiles"] if item["profile_id"] == "query_focus_v1")
        self.assertEqual(query_profile["ctr"], 100.0)
        rec_experiment = next(item for item in summary["experiments"] if item["experiment_id"] == "rec_exp_v1")
        self.assertEqual(rec_experiment["surface"], "content_recommendations")
        self.assertEqual(rec_experiment["purchase_rate"], 50.0)
        self.assertEqual(rec_experiment["variants"][0]["variant_id"], "balanced_v1")
        self.assertEqual(rec_experiment["recommendation"]["status"], "insufficient_variants")

    def test_recommends_ready_winner_when_thresholds_are_met(self):
        now = datetime(2026, 3, 27, tzinfo=timezone.utc)
        events = []
        for _ in range(120):
            events.append({"event_type": "ranking_impression", "metadata": {"ranking_surface": "unified_search", "ranking_profile": "query_focus_v1", "ranking_experiment": "search_exp_v1", "ranking_variant": "query_focus_v1"}, "created_at": now})
        for _ in range(12):
            events.append({"event_type": "product_click", "metadata": {"ranking_surface": "unified_search", "ranking_profile": "query_focus_v1", "ranking_experiment": "search_exp_v1", "ranking_variant": "query_focus_v1"}, "created_at": now})
        for _ in range(2):
            events.append({"event_type": "purchase", "metadata": {"ranking_surface": "unified_search", "ranking_profile": "query_focus_v1", "ranking_experiment": "search_exp_v1", "ranking_variant": "query_focus_v1"}, "created_at": now})

        for _ in range(120):
            events.append({"event_type": "ranking_impression", "metadata": {"ranking_surface": "unified_search", "ranking_profile": "balanced_v1", "ranking_experiment": "search_exp_v1", "ranking_variant": "balanced_v1"}, "created_at": now})
        for _ in range(8):
            events.append({"event_type": "product_click", "metadata": {"ranking_surface": "unified_search", "ranking_profile": "balanced_v1", "ranking_experiment": "search_exp_v1", "ranking_variant": "balanced_v1"}, "created_at": now})

        summary = summarize_ranking_outcomes(events, now=now)
        experiment = next(item for item in summary["experiments"] if item["experiment_id"] == "search_exp_v1")
        self.assertEqual(experiment["recommendation"]["status"], "ready_to_promote")
        self.assertEqual(experiment["recommendation"]["winner_variant_id"], "query_focus_v1")


if __name__ == "__main__":
    unittest.main()
