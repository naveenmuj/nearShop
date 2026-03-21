from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.community.schemas import (
    PostCreate,
    AnswerCreate,
    PostResponse,
    AnswerResponse,
    FeedResponse,
)
from app.community.service import (
    create_post,
    get_local_feed,
    get_post,
    create_answer,
    upvote_post,
    mark_resolved,
)

router = APIRouter(prefix="/api/v1/community", tags=["community"])


def _post_to_response(post, include_answers=False) -> PostResponse:
    """Convert a CommunityPost ORM instance to a PostResponse, avoiding lazy load."""
    answers = None
    if include_answers:
        try:
            answers = [AnswerResponse.model_validate(a) for a in post.answers]
        except Exception:
            answers = []
    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        post_type=post.post_type,
        title=post.title,
        body=post.body,
        images=post.images,
        upvotes=post.upvotes,
        answers_count=post.answers_count,
        is_resolved=post.is_resolved,
        created_at=post.created_at,
        answers=answers,
    )


@router.post("/posts", response_model=PostResponse)
async def create_post_endpoint(
    body: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await create_post(db, current_user.id, body)
    return _post_to_response(post)


@router.get("/posts", response_model=FeedResponse)
@router.get("/feed", response_model=FeedResponse)
async def get_feed_endpoint(
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    sort: str = Query("trending", pattern="^(trending|newest)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    posts, total = await get_local_feed(db, lat, lng, sort, page, per_page)
    return FeedResponse(
        items=[_post_to_response(p) for p in posts],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post_endpoint(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    post = await get_post(db, post_id)
    return _post_to_response(post, include_answers=True)


@router.post("/posts/{post_id}/answers", response_model=AnswerResponse)
async def create_answer_endpoint(
    post_id: UUID,
    body: AnswerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    answer = await create_answer(db, post_id, current_user.id, body)
    return AnswerResponse.model_validate(answer)


@router.post("/posts/{post_id}/upvote", response_model=PostResponse)
async def upvote_post_endpoint(
    post_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await upvote_post(db, post_id, current_user.id)
    return _post_to_response(post)


@router.post("/posts/{post_id}/resolve", response_model=PostResponse)
async def resolve_post_endpoint(
    post_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await mark_resolved(db, post_id, current_user.id)
    return _post_to_response(post)
