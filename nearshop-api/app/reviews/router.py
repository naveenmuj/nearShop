from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer
from app.reviews.schemas import (
    ReviewCreate,
    ShopReplyRequest,
    ReviewResponse,
    ShopReviewsResponse,
)
from app.reviews import service

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])


@router.post("", response_model=ReviewResponse)
async def create_review(
    data: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer),
):
    review = await service.create_review(db, current_user.id, data)
    return review


@router.get("/shop/{shop_id}", response_model=ShopReviewsResponse)
async def get_shop_reviews(
    shop_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await service.get_shop_reviews(db, shop_id, page, per_page)
    return result


@router.post("/{review_id}/reply", response_model=ReviewResponse)
async def reply_to_review(
    review_id: UUID,
    data: ShopReplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_business),
):
    review = await service.reply_to_review(
        db, review_id, current_user.id, data.reply
    )
    return review


@router.get("/my", response_model=list[ReviewResponse])
async def get_my_reviews(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer),
):
    reviews, total = await service.get_user_reviews(
        db, current_user.id, page, per_page
    )
    return reviews
