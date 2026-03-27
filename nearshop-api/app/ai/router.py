import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import BadRequestError
from app.auth.models import User
from app.auth.permissions import get_current_user, get_current_user_optional, require_business, require_customer
from app.config import get_settings

from app.ai.client import get_openai_client
from app.ai.tracker import tracked_chat
from app.ai.cataloging import (
    analyze_product_image,
    analyze_product_image_bytes,
    analyze_shelf_image,
    analyze_shelf_image_bytes,
)
from app.ai.visual_search import generate_image_embedding, search_similar_products
from app.ai.smart_search import parse_search_query
from app.ai.pricing import suggest_price
from app.ai.recommendations import get_recommendation_payloads, get_recommendations
from app.ai.demand_gaps import get_demand_gaps
from app.ai.customer_segments import get_customer_segments
from app.ai.trending import get_trending_products
from app.ai.sentiment import get_sentiment_insights
from app.ai.collaborative_filter import get_cf_recommendations
from app.ai.personalized_deals import get_personalized_deals
from app.ai.catalogue_suggestions import get_catalogue_suggestions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


# ── Request schemas ──────────────────────────────────────────────────────────


class SnapRequest(BaseModel):
    image_url: str


class VisualSearchRequest(BaseModel):
    image_url: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(5.0, gt=0, le=50)
    limit: int = Field(10, ge=1, le=50)


class ConversationalSearchRequest(BaseModel):
    query: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(5.0, gt=0, le=50)


class GenerateDescriptionRequest(BaseModel):
    shop_name: str = Field(..., min_length=1, description="Name of the shop")
    category: str = Field("", description="Shop category")
    keywords: str = Field("", description="Additional keywords or info about the shop")


# ── Cataloging endpoints ────────────────────────────────────────────────────


@router.post("/catalog/snap")
async def catalog_snap(
    image: UploadFile = File(..., description="Product image file"),
    current_user: User = Depends(require_business),
):
    """Analyze a single product image (multipart upload) and extract structured catalog data."""
    image_bytes = await image.read()
    if not image_bytes:
        raise BadRequestError("Uploaded image is empty")
    media_type = image.content_type or "image/jpeg"
    result = await analyze_product_image_bytes(image_bytes, media_type)
    return result


@router.post("/catalog/shelf")
async def catalog_shelf(
    image: UploadFile = File(..., description="Shelf image file"),
    current_user: User = Depends(require_business),
):
    """Analyze a shelf image (multipart upload) and identify all individual products."""
    image_bytes = await image.read()
    media_type = image.content_type or "image/jpeg"
    products = await analyze_shelf_image_bytes(image_bytes, media_type)
    return {"products": products, "count": len(products)}


# ── Search endpoints ────────────────────────────────────────────────────────


@router.post("/search/visual")
async def visual_search(
    body: VisualSearchRequest,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    """Search for visually similar products nearby using an image."""
    settings = get_settings()
    if not settings.FEATURE_VISUAL_SEARCH:
        raise HTTPException(
            status_code=403,
            detail="Visual search is not enabled. Set FEATURE_VISUAL_SEARCH=true to activate.",
        )
    embedding = await generate_image_embedding(body.image_url)
    results = await search_similar_products(
        db,
        embedding,
        lat=body.latitude,
        lng=body.longitude,
        radius_km=body.radius_km,
        limit=body.limit,
    )
    return {"results": results, "count": len(results)}


@router.post("/search/conversational")
async def conversational_search(
    body: ConversationalSearchRequest,
    current_user: User = Depends(get_current_user),
):
    """Parse a natural language search query into structured filters."""
    filters = await parse_search_query(body.query, user_id=current_user.id)
    return {"filters": filters, "original_query": body.query}


# ── Pricing endpoints ───────────────────────────────────────────────────────


@router.get("/pricing/suggest/{product_id}")
async def pricing_suggest(
    product_id: UUID,
    shop_id: UUID = Query(..., description="Shop ID for location-based comparison"),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Suggest a competitive price for a product based on nearby comparables and demand signals."""
    result = await suggest_price(db, product_id, shop_id)
    if "error" in result:
        raise BadRequestError(result["error"])
    return result


# ── Recommendation endpoints ────────────────────────────────────────────────


@router.get("/recommendations")
async def recommendations(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    limit: int = Query(20, ge=1, le=100),
    profile_id: str | None = Query(None),
    include_debug: bool = Query(False),
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    """Get content-based product recommendations with Redis caching."""
    from app.ai.cache import get_cached_recommendations, set_cached_recommendations

    cache_scope = f"content:{profile_id or 'default'}"
    cached = await get_cached_recommendations(str(current_user.id), cache_scope, lat, lng)
    if cached is not None and not include_debug:
        return {"products": cached[:limit], "count": min(len(cached), limit), "cached": True}

    products = await get_recommendation_payloads(db, current_user.id, lat, lng, limit, profile_id=profile_id)
    await set_cached_recommendations(str(current_user.id), cache_scope, lat, lng, products)

    if include_debug:
        return {"products": products, "count": len(products), "cached": False, "debug": True, "profile_id": profile_id}
    return {"products": products, "count": len(products), "cached": False}


@router.get("/recommendations/collaborative")
async def cf_recommendations(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    """Get collaborative-filtering recommendations with Redis caching."""
    from app.ai.cache import get_cached_recommendations, set_cached_recommendations

    cached = await get_cached_recommendations(str(current_user.id), "cf", lat, lng)
    if cached is not None:
        return {"products": cached[:limit], "count": min(len(cached), limit), "type": "collaborative", "cached": True}

    products = await get_cf_recommendations(
        db, current_user.id, lat, lng, radius_km, limit
    )
    await set_cached_recommendations(str(current_user.id), "cf", lat, lng, products)

    return {"products": products, "count": len(products), "type": "collaborative", "cached": False}


# ── Trending feed endpoint (Feature 9) ─────────────────────────────────────


@router.get("/trending")
async def trending_products(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    hours: int = Query(24, ge=1, le=72),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get hyperlocal trending products based on recent event velocity."""
    products = await get_trending_products(db, lat, lng, radius_km, hours, limit)
    return {"products": products, "count": len(products)}


# ── Demand gap analysis (Feature 2) ────────────────────────────────────────


@router.get("/demand-gaps")
async def demand_gaps(
    shop_id: UUID = Query(...),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    days: int = Query(30, ge=1, le=90),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Unfulfilled demand alerts: search terms near your shop that returned few results,
    revealing products you could add to capture existing local demand.
    """
    gaps = await get_demand_gaps(db, shop_id, lat, lng, radius_km, days)
    return {"gaps": gaps, "count": len(gaps)}


# ── Customer segmentation (Feature 4) ──────────────────────────────────────


@router.get("/customer-segments")
async def customer_segments(
    shop_id: UUID = Query(...),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """
    RFM-based customer segmentation: Champions, Loyal, At Risk, Lost, etc.
    Helps identify customers who need a win-back offer.
    """
    result = await get_customer_segments(db, shop_id)
    return result


# ── Review sentiment intelligence (Feature 8) ──────────────────────────────


@router.get("/review-sentiment")
async def review_sentiment(
    shop_id: UUID = Query(...),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """
    AI-powered review sentiment analysis: key positives, negatives, and
    improvement suggestions extracted from customer reviews.
    """
    result = await get_sentiment_insights(db, shop_id)
    return result


# ── Personalised deal feed (Feature 7) ─────────────────────────────────────


@router.get("/deals/personalised")
async def personalised_deals(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    """Get personalised deal feed ranked by user interests and engagement history."""
    deals = await get_personalized_deals(db, current_user.id, lat, lng, radius_km, limit)
    return {"deals": deals, "count": len(deals)}


# ── Catalogue completion suggestions (Feature 10) ──────────────────────────


@router.get("/catalogue-suggestions")
async def catalogue_suggestions(
    shop_id: UUID = Query(...),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Smart catalogue completion: market basket analysis on local orders to find
    product categories you're missing that customers frequently buy together.
    """
    result = await get_catalogue_suggestions(db, shop_id, lat, lng, radius_km)
    return result


# ── Description generation endpoint ───────────────────────────────────────


@router.post("/generate-description")
async def generate_shop_description(
    body: GenerateDescriptionRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a professional shop description using AI."""
    settings = get_settings()

    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured")

    prompt = (
        "Generate a professional, inviting shop description for a local business "
        "with these details:\n"
        f"- Shop name: {body.shop_name}\n"
        f"- Category: {body.category}\n"
        f"- Additional info: {body.keywords}\n\n"
        "Write a 2-3 sentence description that:\n"
        "1. Sounds professional yet warm and inviting\n"
        "2. Highlights what makes this shop special\n"
        "3. Mentions the type of products/services offered\n"
        "4. Is suitable for a local marketplace listing\n"
        "5. Uses natural, conversational language\n\n"
        "Return ONLY the description text, nothing else."
    )

    try:
        response = await tracked_chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o-mini",
            max_tokens=200,
            temperature=0.7,
            feature="description_gen",
            endpoint="/ai/generate-description",
            user_id=current_user.id,
            request_metadata={"shop_name": body.shop_name, "category": body.category},
        )
        description = response.choices[0].message.content.strip().strip('"')
        return {"description": description}
    except Exception as e:
        logger.error("AI description generation failed: %s: %s", type(e).__name__, e)
        raise HTTPException(
            status_code=500, detail=f"AI generation failed: {str(e)}"
        )
