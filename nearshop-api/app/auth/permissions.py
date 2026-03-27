from uuid import UUID

from fastapi import Depends, Header
from jose import JWTError, jwt as jose_jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.core.firebase import verify_firebase_token
from app.core.exceptions import UnauthorizedError, ForbiddenError
import app.shops.models  # noqa: F401


async def get_current_user(
    authorization: str = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Verify the Authorization token.

    Accepts two token formats:
    1. Internal HS256 JWT (issued by /auth/verify-otp) — contains {"sub": "<uuid>", "type": "access"}
    2. Firebase RS256 ID token — verified via Firebase Admin SDK

    The internal JWT is tried first (cheap local decode); Firebase is the fallback.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError("Authorization header missing or malformed")

    id_token = authorization.split(" ", 1)[1].strip()
    if not id_token:
        raise UnauthorizedError("Bearer token is empty")

    header: dict = {}
    try:
        header = jose_jwt.get_unverified_header(id_token) or {}
    except JWTError:
        header = {}

    # Internal tokens are issued as HS256 JWTs. Once identified, do not fall back
    # to Firebase on downstream lookup/validation errors or the caller will get a
    # misleading Firebase error for what is actually an internal-auth problem.
    if header.get("alg") == "HS256":
        from app.core.security import verify_access_token

        payload = verify_access_token(id_token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise UnauthorizedError("Token is missing the sub claim")

        result = await db.execute(
            select(User).where(User.id == UUID(user_id_str))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise UnauthorizedError("User not found for this access token")
        if not user.is_active:
            raise UnauthorizedError("This account has been deactivated.")

        token_role = payload.get("role")
        if token_role and token_role != user.active_role:
            user.active_role = token_role
        return user

    # --- Fallback: Firebase RS256 ID token ---
    decoded = verify_firebase_token(id_token)
    firebase_uid = decoded.get("uid")

    if not firebase_uid:
        raise UnauthorizedError("Token is missing the uid claim")

    result = await db.execute(
        select(User).where(User.firebase_uid == firebase_uid)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedError(
            "User not found. Please complete sign-up at /auth/firebase-signin."
        )
    if not user.is_active:
        raise UnauthorizedError("This account has been deactivated.")

    return user


def require_role(role: str):
    """Return a FastAPI dependency that enforces a specific active_role."""

    async def _dependency(user: User = Depends(get_current_user)) -> User:
        if user.active_role != role:
            raise ForbiddenError(
                f"This endpoint requires the '{role}' role. "
                f"Your current role is '{user.active_role}'."
            )
        return user

    return _dependency


async def get_current_user_optional(
    authorization: str = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of raising for public endpoints."""
    if not authorization:
        return None
    try:
        return await get_current_user(authorization=authorization, db=db)
    except Exception:
        return None


# Convenience dependencies — used as: Depends(require_customer), Depends(require_business)
require_customer = require_role("customer")
require_business = require_role("business")
