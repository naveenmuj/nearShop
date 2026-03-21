from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import BadRequestError
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer

from app.ai.cataloging import (
    analyze_product_image,
    analyze_product_image_bytes,
    analyze_shelf_image,
    analyze_shelf_image_bytes,
)
from app.ai.visual_search import generate_image_embedding, search_similar_products
from app.ai.smart_search import parse_search_query
from app.ai.pricing import suggest_price
from app.ai.recommendations import get_recommendations

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
    filters = await parse_search_query(body.query)
    return {"filters": filters, "original_query": body.query}


# ── Pricing endpoints ───────────────────────────────────────────────────────


@router.get("/pricing/suggest/{product_id}")
async def pricing_suggest(
    product_id: UUID,
    shop_id: UUID = Query(..., description="Shop ID for location-based comparison"),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Suggest a competitive price for a product based on nearby comparables."""
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
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    """Get personalized product recommendations for the current user."""
    products = await get_recommendations(db, current_user.id, lat, lng, limit)
    return {"products": products, "count": len(products)}
