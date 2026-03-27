import unittest
from datetime import datetime, timezone

from app.admin.ranking_analytics import summarize_ranking_report


class RankingDiagnosticsTests(unittest.TestCase):
    def test_summarize_ranking_report_aggregates_metrics(self):
        report = {
            "base_url": "http://127.0.0.1:8010",
            "evaluated_at": "2026-03-27T09:13:44.725117+00:00",
            "personas": {
                "a@example.com": {
                    "content": {"precision_at_5": 0.6, "term_coverage": 1.0},
                    "collaborative": {"precision_at_5": 0.4},
                    "unified_products": {"precision_at_5": 0.8, "term_coverage": 0.8},
                    "unified_shops_count": 5,
                },
                "b@example.com": {
                    "content": {"precision_at_5": 1.0, "term_coverage": 0.8},
                    "collaborative": {"precision_at_5": 0.8},
                    "unified_products": {"precision_at_5": 0.4, "term_coverage": 0.6},
                    "unified_shops_count": 4,
                },
            },
        }
        now = datetime(2026, 3, 27, 12, 0, tzinfo=timezone.utc)

        summary = summarize_ranking_report(report, now=now)

        self.assertEqual(summary["summary"]["persona_count"], 2)
        self.assertEqual(summary["summary"]["content_avg_precision_at_5"], 0.8)
        self.assertEqual(summary["summary"]["collaborative_avg_precision_at_5"], 0.6)
        self.assertEqual(summary["summary"]["unified_avg_precision_at_5"], 0.6)
        self.assertEqual(summary["summary"]["avg_unified_shop_coverage"], 4.5)
        self.assertEqual(summary["summary"]["best_surface"], "content_recommendations")
        self.assertEqual(summary["freshness"]["status"], "fresh")
        self.assertEqual(len(summary["personas"]), 2)


if __name__ == "__main__":
    unittest.main()
