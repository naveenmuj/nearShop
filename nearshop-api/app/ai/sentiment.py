"""Feature 8: Review Sentiment Intelligence.

Batches recent reviews through GPT-4o-mini to extract structured insights:
overall sentiment, key positives, key negatives, and improvement suggestions.
Results are cached in memory for 6 hours to minimise API costs.
"""
import json
import logging
import time
from uuid import UUID

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.reviews.models import Review
from app.auth.models import User
from app.ai.tracker import tracked_chat

logger = logging.getLogger(__name__)

# Simple in-process TTL cache: {shop_id: (timestamp, result)}
_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 6 * 3600  # 6 hours


async def get_sentiment_insights(
    db: AsyncSession,
    shop_id: UUID,
    max_reviews: int = 50,
) -> dict:
    """
    Analyse recent reviews for a shop and return sentiment insights.

    Returns cached result if less than 6 hours old.
    Falls back to rule-based analysis if OpenAI is unavailable.
    """
    cache_key = str(shop_id)
    cached = _CACHE.get(cache_key)
    if cached and (time.time() - cached[0]) < _CACHE_TTL:
        return cached[1]

    # Fetch recent reviews with rating + comment
    stmt = (
        select(Review.rating, Review.comment, Review.created_at)
        .where(
            Review.shop_id == shop_id,
            Review.comment.isnot(None),
            Review.comment != "",
        )
        .order_by(desc(Review.created_at))
        .limit(max_reviews)
    )
    rows = (await db.execute(stmt)).fetchall()

    total_stmt = select(
        Review.rating,
    ).where(Review.shop_id == shop_id)
    all_ratings = (await db.execute(total_stmt)).scalars().all()
    total_count = len(all_ratings)
    avg_rating = round(sum(all_ratings) / total_count, 1) if all_ratings else 0

    if not rows:
        result = _empty_result(avg_rating, total_count)
        _CACHE[cache_key] = (time.time(), result)
        return result

    # Build compact review text for GPT
    review_lines = []
    for r in rows:
        stars = "⭐" * r.rating
        review_lines.append(f"[{stars}] {r.comment.strip()[:200]}")

    review_text = "\n".join(review_lines)

    try:
        response = await tracked_chat(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a business analytics AI. Analyse shop reviews and extract "
                        "structured insights. Respond ONLY with valid JSON."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Here are {len(rows)} customer reviews for a local shop:\n\n"
                        f"{review_text}\n\n"
                        "Analyse these and return JSON with exactly these fields:\n"
                        '{\n'
                        '  "overall_sentiment": "positive|neutral|negative",\n'
                        '  "sentiment_score": <0.0-1.0>,\n'
                        '  "key_positives": ["top 3 things customers love"],\n'
                        '  "key_negatives": ["top 3 complaints"],\n'
                        '  "improvement_suggestions": ["top 3 actionable suggestions"],\n'
                        '  "summary": "2-sentence summary for the shop owner"\n'
                        "}"
                    ),
                },
            ],
            model="gpt-4o-mini",
            feature="sentiment_analysis",
            endpoint="/ai/review-sentiment",
            shop_id=shop_id,
            max_tokens=500,
            temperature=0.3,
            response_format={"type": "json_object"},
            request_metadata={"review_count": len(rows)},
        )
        raw = response.choices[0].message.content
        insights = json.loads(raw)
    except Exception as e:
        logger.warning("GPT sentiment analysis failed: %s", e)
        insights = _rule_based_insights(rows)

    result = {
        "avg_rating": avg_rating,
        "total_reviews": total_count,
        "analysed_reviews": len(rows),
        **insights,
    }
    _CACHE[cache_key] = (time.time(), result)
    return result


def _empty_result(avg_rating: float, total_count: int) -> dict:
    return {
        "avg_rating": avg_rating,
        "total_reviews": total_count,
        "analysed_reviews": 0,
        "overall_sentiment": "neutral",
        "sentiment_score": 0.5,
        "key_positives": [],
        "key_negatives": [],
        "improvement_suggestions": ["Encourage customers to leave reviews to unlock AI insights."],
        "summary": "Not enough reviews to analyse yet. Ask customers to share their experience!",
    }


def _rule_based_insights(rows) -> dict:
    """Fallback when GPT is unavailable — basic star-rating analysis."""
    ratings = [r.rating for r in rows]
    avg = sum(ratings) / len(ratings) if ratings else 3

    if avg >= 4.2:
        sentiment = "positive"
        score = 0.85
        positives = ["High customer satisfaction", "Strong ratings", "Positive overall feedback"]
        negatives = []
        suggestions = ["Keep up the great work!", "Respond to all reviews to build trust"]
    elif avg >= 3.0:
        sentiment = "neutral"
        score = 0.55
        positives = ["Moderate customer satisfaction"]
        negatives = ["Some room for improvement"]
        suggestions = ["Follow up on low-rated orders", "Ask satisfied customers to leave reviews"]
    else:
        sentiment = "negative"
        score = 0.25
        positives = []
        negatives = ["Low average rating", "Multiple dissatisfied customers"]
        suggestions = [
            "Urgently reach out to unhappy customers",
            "Review your product quality and delivery",
            "Consider offering refunds for bad orders",
        ]

    return {
        "overall_sentiment": sentiment,
        "sentiment_score": score,
        "key_positives": positives,
        "key_negatives": negatives,
        "improvement_suggestions": suggestions,
        "summary": f"Average rating is {avg:.1f}/5 based on {len(rows)} reviews.",
    }
