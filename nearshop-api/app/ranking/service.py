from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
import hashlib
from math import isfinite
import json
from pathlib import Path
from typing import Iterable, Sequence

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import Follow, SearchLog, User, UserEvent
from app.config import get_settings
from app.core.geo import haversine_distance_km
from app.orders.models import Order
from app.products.models import Product
from app.shops.models import Shop

settings = get_settings()


@dataclass(slots=True)
class RankingContext:
    lat: float | None = None
    lng: float | None = None
    query: str | None = None
    radius_km: float | None = None
    surface: str = "generic"
    profile_id: str | None = None
    user_id: str | None = None
    expanded_query_terms: set[str] = field(default_factory=set)


@dataclass(slots=True)
class UserPreferenceProfile:
    interests: Counter[str] = field(default_factory=Counter)
    categories: Counter[str] = field(default_factory=Counter)
    subcategories: Counter[str] = field(default_factory=Counter)
    tags: Counter[str] = field(default_factory=Counter)
    viewed_products: set[str] = field(default_factory=set)
    ordered_products: set[str] = field(default_factory=set)
    viewed_shops: set[str] = field(default_factory=set)
    followed_shops: set[str] = field(default_factory=set)
    recent_queries: Counter[str] = field(default_factory=Counter)


@dataclass(frozen=True, slots=True)
class RankingProfile:
    id: str
    label: str
    description: str
    product_weights: dict[str, float]
    shop_weights: dict[str, float]
    deal_weights: dict[str, float]


RANKING_PROFILES: dict[str, RankingProfile] = {
    "balanced_v1": RankingProfile(
        id="balanced_v1",
        label="Balanced",
        description="Default mix of relevance, local quality, and shopper intent.",
        product_weights={
            "match": 1.0,
            "intent": 1.0,
            "popularity": 1.0,
            "query": 1.0,
            "geo": 1.0,
            "quality": 1.0,
            "freshness": 1.0,
        },
        shop_weights={"query": 1.0, "affinity": 1.0, "geo": 1.0, "quality": 1.0},
        deal_weights={"product": 1.0, "discount": 1.0, "scarcity": 1.0, "recency": 1.0},
    ),
    "query_focus_v1": RankingProfile(
        id="query_focus_v1",
        label="Query Focus",
        description="Prioritizes live search intent and strong lexical query matches.",
        product_weights={
            "match": 0.95,
            "intent": 0.8,
            "popularity": 0.85,
            "query": 1.5,
            "geo": 0.9,
            "quality": 0.95,
            "freshness": 0.85,
        },
        shop_weights={"query": 1.45, "affinity": 0.85, "geo": 0.9, "quality": 0.9},
        deal_weights={"product": 1.1, "discount": 0.9, "scarcity": 0.9, "recency": 0.85},
    ),
    "conversion_focus_v1": RankingProfile(
        id="conversion_focus_v1",
        label="Conversion Focus",
        description="Leans toward higher-intent, higher-quality, and better-performing supply.",
        product_weights={
            "match": 1.0,
            "intent": 1.35,
            "popularity": 1.1,
            "query": 0.95,
            "geo": 1.0,
            "quality": 1.25,
            "freshness": 0.8,
        },
        shop_weights={"query": 0.95, "affinity": 1.25, "geo": 1.0, "quality": 1.25},
        deal_weights={"product": 1.2, "discount": 0.95, "scarcity": 1.15, "recency": 0.8},
    ),
}


def get_ranking_profile(profile_id: str | None = None) -> RankingProfile:
    selected = profile_id or settings.ACTIVE_RANKING_PROFILE
    return RANKING_PROFILES.get(selected, RANKING_PROFILES["balanced_v1"])


def _overrides_file() -> Path:
    return Path(settings.RANKING_PROFILE_OVERRIDES_FILE)


def _experiments_file() -> Path:
    return Path(settings.RANKING_EXPERIMENTS_FILE)


def load_runtime_profile_overrides() -> dict[str, str]:
    path = _overrides_file()
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    overrides = payload.get("surface_profiles") if isinstance(payload, dict) else None
    if not isinstance(overrides, dict):
        return {}
    valid: dict[str, str] = {}
    for surface, profile_id in overrides.items():
        if isinstance(surface, str) and isinstance(profile_id, str) and profile_id in RANKING_PROFILES:
            valid[surface] = profile_id
    return valid


def save_runtime_profile_overrides(overrides: dict[str, str]) -> dict[str, str]:
    normalized = {
        surface: get_ranking_profile(profile_id).id
        for surface, profile_id in overrides.items()
        if profile_id in RANKING_PROFILES
    }
    path = _overrides_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime_now_utc().isoformat(),
        "surface_profiles": normalized,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return normalized


def load_runtime_experiments() -> dict[str, dict]:
    path = _experiments_file()
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    experiments = payload.get("surface_experiments") if isinstance(payload, dict) else None
    if not isinstance(experiments, dict):
        return {}
    normalized: dict[str, dict] = {}
    for surface, config in experiments.items():
        if not isinstance(surface, str) or not isinstance(config, dict):
            continue
        experiment_id = config.get("experiment_id")
        variants = config.get("variants")
        if not isinstance(experiment_id, str) or not isinstance(variants, list):
            continue
        valid_variants = []
        for item in variants:
            if not isinstance(item, dict):
                continue
            profile_id = item.get("profile_id")
            weight = item.get("weight")
            if profile_id in RANKING_PROFILES and isinstance(weight, (int, float)) and weight > 0:
                valid_variants.append({"profile_id": profile_id, "weight": float(weight)})
        if len(valid_variants) >= 2:
            normalized[surface] = {
                "experiment_id": experiment_id,
                "variants": valid_variants,
            }
    return normalized


def save_runtime_experiments(experiments: dict[str, dict]) -> dict[str, dict]:
    normalized: dict[str, dict] = {}
    for surface, config in experiments.items():
        if not isinstance(config, dict):
            continue
        experiment_id = config.get("experiment_id")
        variants = config.get("variants")
        if not isinstance(surface, str) or not isinstance(experiment_id, str) or not isinstance(variants, list):
            continue
        valid_variants = []
        for item in variants:
            profile_id = item.get("profile_id") if isinstance(item, dict) else None
            weight = item.get("weight") if isinstance(item, dict) else None
            if profile_id in RANKING_PROFILES and isinstance(weight, (int, float)) and weight > 0:
                valid_variants.append({"profile_id": profile_id, "weight": float(weight)})
        if len(valid_variants) >= 2:
            normalized[surface] = {"experiment_id": experiment_id, "variants": valid_variants}
    path = _experiments_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime_now_utc().isoformat(),
        "surface_experiments": normalized,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return normalized


def get_default_surface_profiles() -> dict[str, str]:
    return {
        "global_default": get_ranking_profile().id,
        "unified_search": get_ranking_profile(settings.SEARCH_RANKING_PROFILE or settings.ACTIVE_RANKING_PROFILE).id,
        "ai_recommendations": get_ranking_profile(settings.RECOMMENDATION_RANKING_PROFILE or settings.ACTIVE_RANKING_PROFILE).id,
        "nearby_deals": get_ranking_profile(settings.DEALS_RANKING_PROFILE or settings.ACTIVE_RANKING_PROFILE).id,
        "home_feed": get_ranking_profile(settings.HOME_FEED_RANKING_PROFILE or settings.ACTIVE_RANKING_PROFILE).id,
    }


def resolve_ranking_profile_id(surface: str | None, requested_profile_id: str | None = None) -> str:
    if requested_profile_id:
        return get_ranking_profile(requested_profile_id).id

    defaults = get_default_surface_profiles()
    runtime_overrides = load_runtime_profile_overrides()
    selected = runtime_overrides.get(surface or "")
    if selected:
        return get_ranking_profile(selected).id

    if surface == "search_unified":
        return defaults["unified_search"]
    if surface == "deals_feed":
        return defaults["nearby_deals"]
    return defaults.get(surface or "", defaults["global_default"])


def list_ranking_profiles() -> list[dict[str, str]]:
    active_id = get_ranking_profile().id
    return [
        {
            "id": profile.id,
            "label": profile.label,
            "description": profile.description,
            "active": profile.id == active_id,
        }
        for profile in RANKING_PROFILES.values()
    ]


def get_surface_profile_overrides() -> dict[str, dict[str, str | bool]]:
    defaults = get_default_surface_profiles()
    runtime_overrides = load_runtime_profile_overrides()
    surfaces = {
        "global_default": defaults["global_default"],
        "unified_search": resolve_ranking_profile_id("unified_search"),
        "ai_recommendations": resolve_ranking_profile_id("ai_recommendations"),
        "nearby_deals": resolve_ranking_profile_id("nearby_deals"),
        "home_feed": resolve_ranking_profile_id("home_feed"),
    }
    default_id = defaults["global_default"]
    return {
        surface: {
            "id": profile_id,
            "label": get_ranking_profile(profile_id).label,
            "overridden": surface in runtime_overrides or (surface != "global_default" and profile_id != defaults.get(surface, default_id)),
        }
        for surface, profile_id in surfaces.items()
    }


def get_surface_experiments() -> dict[str, dict]:
    experiments = load_runtime_experiments()
    formatted: dict[str, dict] = {}
    for surface, config in experiments.items():
        formatted[surface] = {
            "experiment_id": config["experiment_id"],
            "variants": [
                {
                    "profile_id": item["profile_id"],
                    "label": get_ranking_profile(item["profile_id"]).label,
                    "weight": item["weight"],
                }
                for item in config["variants"]
            ],
        }
    return formatted


def resolve_ranking_selection(
    surface: str | None,
    user_id: str | None = None,
    requested_profile_id: str | None = None,
) -> dict[str, str | None]:
    profile_id = resolve_ranking_profile_id(surface, requested_profile_id)
    if requested_profile_id or not surface or not user_id:
        return {
            "profile_id": profile_id,
            "experiment_id": None,
            "variant_id": None,
        }

    experiment = load_runtime_experiments().get(surface)
    if not experiment:
        return {
            "profile_id": profile_id,
            "experiment_id": None,
            "variant_id": None,
        }

    digest = hashlib.sha256(f"{experiment['experiment_id']}:{surface}:{user_id}".encode("utf-8")).hexdigest()
    bucket = int(digest[:8], 16) / 0xFFFFFFFF
    total_weight = sum(item["weight"] for item in experiment["variants"])
    cumulative = 0.0
    selected_profile = profile_id
    for item in experiment["variants"]:
        cumulative += item["weight"] / total_weight
        if bucket <= cumulative:
            selected_profile = item["profile_id"]
            break
    return {
        "profile_id": selected_profile,
        "experiment_id": experiment["experiment_id"],
        "variant_id": selected_profile,
    }


def _normalize_token(value: str | None) -> str | None:
    if not value:
        return None
    token = value.strip().lower()
    return token or None


def _tokens_from_text(value: str | None) -> set[str]:
    if not value:
        return set()
    cleaned = (
        value.replace("/", " ")
        .replace("-", " ")
        .replace(",", " ")
        .replace(".", " ")
        .lower()
    )
    return {token for token in cleaned.split() if token}


def _safe_float(value) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return number if isfinite(number) else 0.0


async def build_user_preference_profile(
    db: AsyncSession,
    user_id,
    *,
    event_limit: int = 80,
    order_limit: int = 20,
    search_limit: int = 20,
) -> UserPreferenceProfile:
    profile = UserPreferenceProfile()
    if not user_id:
        return profile

    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    for interest in user.interests or [] if user else []:
        normalized = _normalize_token(interest)
        if normalized:
            profile.interests[normalized] += 6
            profile.categories[normalized] += 3

    event_rows = (
        await db.execute(
            select(
                UserEvent.event_type,
                UserEvent.entity_type,
                UserEvent.entity_id,
                UserEvent.metadata_,
            )
            .where(UserEvent.user_id == user_id)
            .order_by(desc(UserEvent.created_at))
            .limit(event_limit)
        )
    ).all()

    product_signal_weights = {
        "product_view": 2,
        "wishlist_add": 4,
        "add_to_cart": 6,
        "product_click": 2,
        "purchase_intent": 5,
    }

    for event_type, entity_type, entity_id, metadata in event_rows:
        metadata = metadata or {}
        if entity_type == "product" and entity_id:
            profile.viewed_products.add(str(entity_id))
            product_meta = metadata if isinstance(metadata, dict) else {}
            weight = product_signal_weights.get(event_type, 1)
            category = _normalize_token(product_meta.get("category"))
            subcategory = _normalize_token(product_meta.get("subcategory"))
            if category:
                profile.categories[category] += weight
            if subcategory:
                profile.subcategories[subcategory] += weight + 1
            for tag in product_meta.get("tags") or []:
                normalized = _normalize_token(tag)
                if normalized:
                    profile.tags[normalized] += max(weight - 1, 1)

        if entity_type == "shop" and entity_id:
            profile.viewed_shops.add(str(entity_id))

    if profile.viewed_products:
        viewed_product_rows = (
            await db.execute(
                select(Product.category, Product.subcategory, Product.tags)
                .where(Product.id.in_(list(profile.viewed_products)))
            )
        ).all()
        for category, subcategory, tags in viewed_product_rows:
            normalized_category = _normalize_token(category)
            normalized_subcategory = _normalize_token(subcategory)
            if normalized_category:
                profile.categories[normalized_category] += 3
            if normalized_subcategory:
                profile.subcategories[normalized_subcategory] += 4
            for tag in tags or []:
                normalized = _normalize_token(tag)
                if normalized:
                    profile.tags[normalized] += 2

    order_rows = (
        await db.execute(
            select(Order.items)
            .where(
                Order.customer_id == user_id,
                Order.status.not_in(["cancelled", "rejected"]),
            )
            .order_by(desc(Order.created_at))
            .limit(order_limit)
        )
    ).scalars().all()

    for items in order_rows:
        if not isinstance(items, list):
            continue
        for item in items:
            product_id = item.get("product_id") or item.get("id")
            if not product_id:
                continue
            profile.ordered_products.add(str(product_id))

    if profile.ordered_products:
        ordered_product_rows = (
            await db.execute(
                select(Product.category, Product.subcategory, Product.tags, Product.shop_id)
                .where(Product.id.in_(list(profile.ordered_products)))
            )
        ).all()
        for category, subcategory, tags, shop_id in ordered_product_rows:
            normalized_category = _normalize_token(category)
            normalized_subcategory = _normalize_token(subcategory)
            if normalized_category:
                profile.categories[normalized_category] += 6
            if normalized_subcategory:
                profile.subcategories[normalized_subcategory] += 8
            for tag in tags or []:
                normalized = _normalize_token(tag)
                if normalized:
                    profile.tags[normalized] += 3
            if shop_id:
                profile.viewed_shops.add(str(shop_id))

    followed_rows = (
        await db.execute(select(Follow.shop_id).where(Follow.user_id == user_id))
    ).scalars().all()
    profile.followed_shops = {str(shop_id) for shop_id in followed_rows if shop_id}

    search_rows = (
        await db.execute(
            select(SearchLog.query, SearchLog.query_text)
            .where(SearchLog.user_id == user_id)
            .order_by(desc(SearchLog.created_at))
            .limit(search_limit)
        )
    ).all()
    for row in search_rows:
        if isinstance(row, tuple):
            short_query, query_text = row
        else:
            short_query = getattr(row, "query", None)
            query_text = getattr(row, "query_text", None)
        candidate = short_query or query_text
        for token in _tokens_from_text(candidate):
            profile.recent_queries[token] += 1

    return profile


def product_score_breakdown(product: Product, shop: Shop | None, profile: UserPreferenceProfile, context: RankingContext) -> dict[str, float]:
    category = _normalize_token(getattr(product, "category", None))
    subcategory = _normalize_token(getattr(product, "subcategory", None))
    tags = [_normalize_token(tag) for tag in (getattr(product, "tags", None) or [])]
    tags = [tag for tag in tags if tag]
    product_id = str(getattr(product, "id", ""))
    shop_id = str(getattr(product, "shop_id", getattr(shop, "id", "")) or "")

    match = 0.0
    match += profile.categories.get(category, 0) * 2.4 if category else 0.0
    match += profile.subcategories.get(subcategory, 0) * 3.2 if subcategory else 0.0
    match += sum(profile.tags.get(tag, 0) for tag in tags) * 1.5

    intent = 0.0
    if product_id in profile.viewed_products:
        intent += 4.0
    if product_id in profile.ordered_products:
        intent -= 8.0
    if shop_id and shop_id in profile.followed_shops:
        intent += 3.0
    elif shop_id and shop_id in profile.viewed_shops:
        intent += 1.5

    popularity = (
        _safe_float(getattr(product, "view_count", 0)) * 0.08
        + _safe_float(getattr(product, "wishlist_count", 0)) * 0.65
        + _safe_float(getattr(product, "inquiry_count", 0)) * 0.9
    )
    if getattr(product, "is_featured", False):
        popularity += 1.2

    query_score = 0.0
    query_tokens = context.expanded_query_terms or _tokens_from_text(context.query)
    if query_tokens:
        name_tokens = _tokens_from_text(getattr(product, "name", None))
        category_tokens = _tokens_from_text(getattr(product, "category", None))
        tag_tokens = set(tags)
        overlap = len(query_tokens & (name_tokens | category_tokens | tag_tokens))
        if overlap:
            query_score += overlap * 8.0
        recent_query_overlap = sum(profile.recent_queries.get(token, 0) for token in query_tokens)
        query_score += recent_query_overlap * 1.5

    geo = 0.0
    if context.lat is not None and context.lng is not None and shop is not None:
        distance = _safe_float(haversine_distance_km(context.lat, context.lng, shop.latitude, shop.longitude))
        geo += max(0.0, 8.0 - distance * 1.35)

    quality = 0.0
    if shop is not None:
        quality += max(0.0, _safe_float(getattr(shop, "avg_rating", 0.0)) - 3.0) * 2.0
        quality += _safe_float(getattr(shop, "score", 0.0)) * 0.05

    freshness = 0.0
    created_at = getattr(product, "created_at", None)
    if created_at is not None:
        try:
            age_hours = max(0.0, (datetime_now_utc() - created_at).total_seconds() / 3600)
            freshness += max(0.0, 5.0 - age_hours / 48.0)
        except Exception:
            pass

    weights = get_ranking_profile(resolve_ranking_profile_id(context.surface, context.profile_id)).product_weights
    return {
        "match": round(match * weights["match"], 3),
        "intent": round(intent * weights["intent"], 3),
        "popularity": round(popularity * weights["popularity"], 3),
        "query": round(query_score * weights["query"], 3),
        "geo": round(geo * weights["geo"], 3),
        "quality": round(quality * weights["quality"], 3),
        "freshness": round(freshness * weights["freshness"], 3),
    }


def score_product(product: Product, shop: Shop | None, profile: UserPreferenceProfile, context: RankingContext) -> float:
    breakdown = product_score_breakdown(product, shop, profile, context)
    return round(sum(breakdown.values()), 3)


def rank_products(
    products: Sequence[Product],
    profile: UserPreferenceProfile,
    context: RankingContext,
) -> list[Product]:
    ranked: list[tuple[float, Product]] = []
    for product in products:
        shop = getattr(product, "shop", None)
        ranked.append((score_product(product, shop, profile, context), product))

    ranked.sort(
        key=lambda item: (
            item[0],
            _safe_float(getattr(item[1], "wishlist_count", 0)),
            _safe_float(getattr(item[1], "view_count", 0)),
            _safe_float(getattr(getattr(item[1], "shop", None), "avg_rating", 0)),
        ),
        reverse=True,
    )
    return [product for _, product in ranked]


def top_product_reason(
    product: Product,
    shop: Shop | None,
    profile: UserPreferenceProfile,
    context: RankingContext,
) -> str:
    breakdown = product_score_breakdown(product, shop, profile, context)
    dominant = max(breakdown.items(), key=lambda item: item[1])[0]
    reason_map = {
        "match": "Strong match for this shopper's interests",
        "intent": "Boosted by the shopper's recent activity",
        "popularity": "Popular with nearby shoppers",
        "query": "Best semantic match for the current search",
        "geo": "Very close to the shopper's location",
        "quality": "High-quality shop with strong ratings",
        "freshness": "Freshly added product",
    }
    return reason_map.get(dominant, "Relevant for this shopper")


def shop_score_breakdown(
    shop: Shop,
    profile: UserPreferenceProfile,
    context: RankingContext,
) -> dict[str, float]:
    shop_id = str(getattr(shop, "id", "") or "")
    query_tokens = context.expanded_query_terms or _tokens_from_text(context.query)
    text_tokens = (
        _tokens_from_text(getattr(shop, "name", None))
        | _tokens_from_text(getattr(shop, "category", None))
        | _tokens_from_text(getattr(shop, "description", None))
    )

    query_score = 0.0
    if query_tokens:
        overlap = len(query_tokens & text_tokens)
        query_score += overlap * 8.0
        recent_query_overlap = sum(profile.recent_queries.get(token, 0) for token in query_tokens)
        query_score += recent_query_overlap * 1.25

    affinity = 0.0
    if shop_id in profile.followed_shops:
        affinity += 7.0
    elif shop_id in profile.viewed_shops:
        affinity += 3.0

    geo = 0.0
    if context.lat is not None and context.lng is not None:
        distance = _safe_float(
            haversine_distance_km(context.lat, context.lng, shop.latitude, shop.longitude)
        )
        geo += max(0.0, 7.0 - distance * 1.2)

    quality = max(0.0, _safe_float(getattr(shop, "avg_rating", 0.0)) - 3.0) * 2.2
    quality += _safe_float(getattr(shop, "score", 0.0)) * 0.06
    quality += _safe_float(getattr(shop, "total_reviews", 0.0)) * 0.03

    weights = get_ranking_profile(resolve_ranking_profile_id(context.surface, context.profile_id)).shop_weights
    return {
        "query": round(query_score * weights["query"], 3),
        "affinity": round(affinity * weights["affinity"], 3),
        "geo": round(geo * weights["geo"], 3),
        "quality": round(quality * weights["quality"], 3),
    }


def score_shop(shop: Shop, profile: UserPreferenceProfile, context: RankingContext) -> float:
    return round(sum(shop_score_breakdown(shop, profile, context).values()), 3)


def rank_shops(
    shops: Sequence[Shop],
    profile: UserPreferenceProfile,
    context: RankingContext,
) -> list[Shop]:
    ranked: list[tuple[float, Shop]] = []
    for shop in shops:
        ranked.append((score_shop(shop, profile, context), shop))
    ranked.sort(
        key=lambda item: (
            item[0],
            _safe_float(getattr(item[1], "avg_rating", 0)),
            _safe_float(getattr(item[1], "score", 0)),
            _safe_float(getattr(item[1], "total_reviews", 0)),
        ),
        reverse=True,
    )
    return [shop for _, shop in ranked]


def top_shop_reason(shop: Shop, profile: UserPreferenceProfile, context: RankingContext) -> str:
    breakdown = shop_score_breakdown(shop, profile, context)
    dominant = max(breakdown.items(), key=lambda item: item[1])[0]
    reason_map = {
        "query": "Best match for the current search",
        "affinity": "Previously visited or followed by the shopper",
        "geo": "Close to the shopper's location",
        "quality": "Strong ratings and local shop quality",
    }
    return reason_map.get(dominant, "Relevant nearby shop")


def score_deal(deal, shop: Shop | None, product: Product | None, profile: UserPreferenceProfile, context: RankingContext) -> float:
    product_stub = product
    if product_stub is None:
        product_stub = Product(
            id=getattr(deal, "product_id", None),
            shop_id=getattr(deal, "shop_id", None),
            name=getattr(deal, "title", ""),
            category=None,
            subcategory=None,
            tags=None,
            view_count=0,
            wishlist_count=0,
            inquiry_count=0,
            is_featured=False,
        )
    product_component = score_product(product_stub, shop, profile, context) * 0.45
    discount_component = _safe_float(getattr(deal, "discount_pct", 0)) * 0.5 + _safe_float(getattr(deal, "discount_amount", 0)) * 0.03
    scarcity_component = 0.0
    max_claims = _safe_float(getattr(deal, "max_claims", 0))
    current_claims = _safe_float(getattr(deal, "current_claims", 0))
    if max_claims > 0:
        scarcity_component += min(10.0, (current_claims / max_claims) * 10.0)
    recency_component = 0.0
    created_at = getattr(deal, "created_at", None)
    if created_at is not None:
        try:
            age_hours = max(0.0, (datetime_now_utc() - created_at).total_seconds() / 3600)
            recency_component += max(0.0, 6.0 - age_hours / 24.0)
        except Exception:
            pass
    weights = get_ranking_profile(resolve_ranking_profile_id(context.surface, context.profile_id)).deal_weights
    return round(
        product_component * weights["product"]
        + discount_component * weights["discount"]
        + scarcity_component * weights["scarcity"]
        + recency_component * weights["recency"],
        3,
    )


def rank_deals(rows: Iterable[tuple], profile: UserPreferenceProfile, context: RankingContext) -> list[tuple]:
    scored: list[tuple[float, tuple]] = []
    for row in rows:
        deal = getattr(row, "Deal", None) or row[0]
        shop = getattr(row, "Shop", None) or (row[1] if len(row) > 1 else None) or getattr(deal, "shop", None)
        product = getattr(row, "Product", None) or (row[2] if len(row) > 2 else None) or getattr(deal, "product", None)
        scored.append((score_deal(deal, shop, product, profile, context), row))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [row for _, row in scored]


def datetime_now_utc():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)
