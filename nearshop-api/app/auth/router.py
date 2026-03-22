from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.auth.schemas import (
    CompleteProfileRequest,
    FirebaseSignInRequest,
    SendOTPRequest,
    SwitchRoleRequest,
    UserResponse,
    VerifyOTPRequest,
)
from app.auth.service import AuthService
from app.core.exceptions import BadRequestError
from app.core.firebase import verify_firebase_token
from app.core.security import create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ========================================
# LOCAL OTP ENDPOINTS (BACKUP/LEGACY)
# ========================================
# NOTE: These endpoints generate OTP locally and are NOT the primary authentication method.
# The primary auth flow uses Firebase Authentication for all phone OTP operations.
#
# Frontend (Web & Mobile) uses Firebase directly via:
#   - Web: signInWithPhoneNumber() from Firebase SDK
#   - Mobile: sendFirebaseOtp() wrapper around Firebase React Native SDK
#
# These local endpoints exist as a fallback but are not integrated with the
# main authentication flow. Consider removing or clearly documenting their purpose.
# ========================================

@router.post("/send-otp")
async def send_otp(
    body: SendOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    ⚠️ LEGACY ENDPOINT - Not used in primary flow

    Generates and sends OTP locally (logs to console in dev).
    The primary authentication method uses Firebase phone authentication.
    """
    result = await AuthService.send_otp(db, body.phone)
    return result


@router.post("/verify-otp")
async def verify_otp(
    body: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    ⚠️ LEGACY ENDPOINT - Not used in primary flow

    Verifies OTP that was generated locally.
    The primary authentication method uses Firebase phone authentication.
    """
    result = await AuthService.verify_otp(db, body.phone, body.code)
    return result


@router.post("/complete-profile", response_model=UserResponse)
async def complete_profile(
    body: CompleteProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await AuthService.complete_profile(db, current_user.id, body)
    return UserResponse.model_validate(user)


@router.post("/switch-role", response_model=UserResponse)
async def switch_role(
    body: SwitchRoleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await AuthService.switch_role(db, current_user.id, body.role)
    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return UserResponse.model_validate(current_user)


@router.post("/firebase-signin")
async def firebase_signin(
    body: FirebaseSignInRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    🔐 PRIMARY AUTHENTICATION ENDPOINT - Firebase Token Exchange

    This is the main authentication endpoint used by both web and mobile apps.
    All authentication methods (Phone OTP, Google, Apple, Email/Password) go through
    Firebase first, then exchange the Firebase ID token here for an internal JWT.

    Flow:
      1. User authenticates via Firebase (Phone OTP / Google / Apple / Email)
      2. Firebase returns an ID token (RS256, verified by Google's keys)
      3. Frontend sends this ID token to this endpoint
      4. Backend verifies the ID token using Firebase Admin SDK
      5. Backend creates or updates the User record in the database
      6. Backend issues an internal JWT (HS256) for subsequent API calls
      7. Returns: { user, access_token, is_new_user, provider }

    Why exchange tokens?
      - Performance: Local JWT verification is 100x faster than Firebase Admin SDK calls
      - Cost: Avoids Firebase quota limits on every API request
      - Flexibility: Can add custom claims (roles, permissions) to internal JWT
      - Offline: Internal JWT can be verified without internet connection

    Supported Firebase providers:
      - phone (Phone OTP via SMS)
      - google.com (Google Sign-In)
      - apple.com (Apple Sign-In)
      - password (Email/Password)
    """
    firebase_id_token = body.firebase_token or body.id_token

    if not firebase_id_token:
        raise BadRequestError("firebase_token is required")

    decoded = verify_firebase_token(firebase_id_token)

    firebase_uid = decoded.get("uid")
    phone = decoded.get("phone_number")
    email = decoded.get("email")
    name = decoded.get("name", "")
    picture = decoded.get("picture", "")
    provider = decoded.get("firebase", {}).get("sign_in_provider", "phone")

    from sqlalchemy import or_
    conditions = [User.firebase_uid == firebase_uid]
    if phone:
        conditions.append(User.phone == phone)
    if email:
        conditions.append(User.email == email)

    result = await db.execute(select(User).where(or_(*conditions)))
    user = result.scalar_one_or_none()
    is_new_user = False

    if user is None:
        is_new_user = True
        from app.core.security import generate_referral_code
        user = User(
            firebase_uid=firebase_uid,
            phone=phone,
            email=email,
            name=name or "",
            avatar_url=picture or None,
            referral_code=generate_referral_code(),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
    else:
        if not user.firebase_uid:
            user.firebase_uid = firebase_uid
        if not user.name and name:
            user.name = name
        if not user.avatar_url and picture:
            user.avatar_url = picture
        await db.flush()
        await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})

    return {
        "user": UserResponse.model_validate(user),
        "access_token": access_token,
        "is_new_user": is_new_user,
        "provider": provider,
    }
