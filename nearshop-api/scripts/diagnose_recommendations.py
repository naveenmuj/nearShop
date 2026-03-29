import asyncio
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select
from sqlalchemy.orm import joinedload, load_only

# Ensure ORM relationship targets are registered before queries run.
import app.auth.models  # noqa: F401
import app.reviews.models  # noqa: F401
import app.orders.models  # noqa: F401
import app.deals.models  # noqa: F401
import app.stories.models  # noqa: F401
import app.delivery.models  # noqa: F401

from app.ai.recommendations import (
    _expanded_recommendation_terms,
    _prepare_recommendation_profile,
    _candidate_seed_score,
    _diversify_ranked_products,
    _product_text_tokens,
    _select_candidate_pool,
)
from app.auth.models import User
from app.core.database import get_async_session
from app.core.geo import within_radius
from app.products.models import Product
from app.ranking.demo_fixtures import ensure_recommendation_fixtures
from app.ranking.service import (
    RankingContext,
    build_user_preference_profile,
    product_score_breakdown,
    rank_products,
    resolve_ranking_selection,
)
from app.shops.models import Shop


REPORT_PATH = Path(__file__).resolve().parents[2] / "docs" / "recommendation_diagnostics_report.json"
PERSONAS = {
    "ml.c1.1774488839@example.com": {
        "expected_terms": {"gaming", "mouse", "keyboard", "headset", "mousepad"},
    },
    "ml.c4@example.com": {
        "expected_terms": {"audio", "earbuds", "speaker", "headphones", "bluetooth"},
    },
    "ml.c5@example.com": {
        "expected_terms": {"streaming", "webcam", "microphone", "ring", "usb"},
    },
}


def _hits_for_product(product: Product, expected_terms: set[str]) -> list[str]:
    tokens = _product_text_tokens(product)
    return sorted(term for term in expected_terms if term in tokens)


def _top_counter_items(counter, limit: int = 12) -> list[dict]:
    return [
        {"token": token, "weight": count}
        for token, count in counter.most_common(limit)
    ]


async def _load_persona_ids(db) -> dict[str, str]:
    rows = (
        await db.execute(
            select(User.id, User.email)
            .where(User.email.in_(list(PERSONAS.keys())))
        )
    ).all()
    return {email: str(user_id) for user_id, email in rows}


async def _load_anchor_location(db) -> tuple[float, float]:
    fixture_state = await ensure_recommendation_fixtures(db)
    return float(fixture_state["anchor_lat"]), float(fixture_state["anchor_lng"])


async def _load_candidates(db, lat: float, lng: float, limit: int = 120) -> list[Product]:
    stmt = (
        select(Product)
        .join(Shop, Shop.id == Product.shop_id)
        .options(
            joinedload(Product.shop).load_only(
                Shop.id,
                Shop.name,
                Shop.slug,
                Shop.logo_url,
                Shop.latitude,
                Shop.longitude,
                Shop.avg_rating,
                Shop.score,
            )
        )
        .where(Product.is_available == True)  # noqa: E712
        .where(Shop.is_active == True)  # noqa: E712
        .where(within_radius(Shop.latitude, Shop.longitude, lat, lng, 5.0))
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _product_snapshot(product: Product, *, expected_terms: set[str], seed_score: float | None = None, ranking_breakdown: dict | None = None) -> dict:
    snapshot = {
        "id": str(product.id),
        "name": product.name,
        "shop_id": str(product.shop_id),
        "shop_name": getattr(getattr(product, "shop", None), "name", None),
        "category": product.category,
        "subcategory": product.subcategory,
        "tags": product.tags or [],
        "hits": _hits_for_product(product, expected_terms),
        "tokens": sorted(_product_text_tokens(product)),
    }
    if seed_score is not None:
        snapshot["seed_score"] = round(seed_score, 3)
    if ranking_breakdown is not None:
        snapshot["ranking_breakdown"] = ranking_breakdown
        snapshot["ranking_score"] = round(sum(ranking_breakdown.values()), 3)
    return snapshot


async def diagnose() -> dict:
    report = {
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "personas": {},
    }

    async with get_async_session() as db:
        fixture_state = await ensure_recommendation_fixtures(db)
        persona_ids = await _load_persona_ids(db)
        lat = float(fixture_state["anchor_lat"])
        lng = float(fixture_state["anchor_lng"])
        candidates = await _load_candidates(db, lat, lng)

        for email, config in PERSONAS.items():
            user_id = persona_ids[email]
            expected_terms = config["expected_terms"]
            profile = await build_user_preference_profile(db, user_id)
            tuned_profile = _prepare_recommendation_profile(profile)
            selection = resolve_ranking_selection("ai_recommendations", user_id, None)
            context = RankingContext(
                lat=lat,
                lng=lng,
                radius_km=5.0,
                surface="ai_recommendations",
                profile_id=selection["profile_id"],
                user_id=user_id,
                expanded_query_terms=_expanded_recommendation_terms(tuned_profile),
            )

            seed_ranked = sorted(
                [(_candidate_seed_score(product, tuned_profile), product) for product in candidates],
                key=lambda item: (item[0], float(item[1].wishlist_count or 0), float(item[1].view_count or 0)),
                reverse=True,
            )
            candidate_pool = _select_candidate_pool(candidates, tuned_profile, 5)
            ranked_pool = rank_products(candidate_pool, tuned_profile, context)
            selected = _diversify_ranked_products(ranked_pool, tuned_profile, context, 5)

            report["personas"][email] = {
                "profile_summary": {
                    "recent_queries": _top_counter_items(profile.recent_queries),
                    "categories": _top_counter_items(profile.categories),
                    "subcategories": _top_counter_items(profile.subcategories),
                    "tags": _top_counter_items(profile.tags),
                    "followed_shops": sorted(profile.followed_shops),
                    "viewed_products_count": len(profile.viewed_products),
                    "ordered_products_count": len(profile.ordered_products),
                },
                "candidate_counts": {
                    "nearby_candidates": len(candidates),
                    "seed_ranked": len(seed_ranked),
                    "candidate_pool": len(candidate_pool),
                    "final_selected": len(selected),
                },
                "top_seed_candidates": [
                    _product_snapshot(product, expected_terms=expected_terms, seed_score=seed_score)
                    for seed_score, product in seed_ranked[:10]
                ],
                "final_selected": [
                    _product_snapshot(
                        product,
                        expected_terms=expected_terms,
                        seed_score=_candidate_seed_score(product, tuned_profile),
                        ranking_breakdown=product_score_breakdown(product, getattr(product, "shop", None), tuned_profile, context),
                    )
                    for product in selected
                ],
                "selected_misses": [
                    _product_snapshot(
                        product,
                        expected_terms=expected_terms,
                        seed_score=_candidate_seed_score(product, tuned_profile),
                        ranking_breakdown=product_score_breakdown(product, getattr(product, "shop", None), tuned_profile, context),
                    )
                    for product in selected
                    if not _hits_for_product(product, expected_terms)
                ],
            }

    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"report_path={REPORT_PATH}")
    return report


if __name__ == "__main__":
    asyncio.run(diagnose())
