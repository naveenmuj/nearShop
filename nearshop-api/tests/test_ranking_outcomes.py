from datetime import datetime, timezone
import unittest

from app.admin.ranking_outcomes import summarize_ranking_outcomes


class RankingOutcomesSummaryTests(unittest.TestCase):
    def test_summarizes_surface_metrics(self):
        now = datetime(2026, 3, 27, tzinfo=timezone.utc)
        events = [
            {"event_type": "ranking_impression", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match"}, "created_at": now},
            {"event_type": "ranking_impression", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match"}, "created_at": now},
            {"event_type": "product_click", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match"}, "created_at": now},
            {"event_type": "add_to_cart", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match"}, "created_at": now},
            {"event_type": "purchase", "metadata": {"ranking_surface": "content_recommendations", "ranking_reason": "ai_match"}, "created_at": now},
            {"event_type": "ranking_impression", "metadata": {"ranking_surface": "unified_search", "ranking_reason": "query_match"}, "created_at": now},
            {"event_type": "product_click", "metadata": {"ranking_surface": "unified_search", "ranking_reason": "query_match"}, "created_at": now},
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


if __name__ == "__main__":
    unittest.main()
