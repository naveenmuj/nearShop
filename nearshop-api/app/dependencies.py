from typing import Optional
from uuid import UUID

from fastapi import Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.core.security import decode_token


class PaginationParams:
    """Common pagination parameters for list endpoints."""

    def __init__(
        self,
        skip: int = Query(0, ge=0, description="Number of records to skip"),
        limit: int = Query(20, ge=1, le=100, description="Max records to return"),
    ):
        self.skip = skip
        self.limit = limit


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Extract authenticated user from token without raising on failure.

    Returns ``None`` when the request has no valid bearer token instead of
    raising an ``UnauthorizedError``.  Useful for endpoints that behave
    differently for authenticated vs. anonymous visitors (e.g. the feed).
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except Exception:
        return None

    if payload.get("type") != "access":
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        return None

    return user
