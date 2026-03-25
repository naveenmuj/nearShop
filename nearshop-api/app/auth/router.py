from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
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
    UpdateProfileRequest,
    UserResponse,
    VerifyOTPRequest,
)
from app.auth.service import AuthService
from app.core.exceptions import BadRequestError
from app.core.firebase import verify_firebase_token
from app.core.security import create_access_token


class UserSettingsRequest(BaseModel):
    sound_enabled: bool


class DeleteAccountRequest(BaseModel):
    delete_customer: bool = True
    delete_business: bool = False

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/send-otp")
async def send_otp(
    body: SendOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await AuthService.send_otp(db, body.phone)
    return result


@router.post("/verify-otp")
async def verify_otp(
    body: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
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


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await AuthService.update_profile(db, current_user.id, body)
    return UserResponse.model_validate(user)


@router.patch("/settings", response_model=UserResponse)
async def update_settings(
    body: UserSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user settings (e.g. sound_enabled)."""
    current_user.sound_enabled = body.sound_enabled
    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.delete("/delete-account")
async def delete_account(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete user account. Options:
    - delete_customer=true, delete_business=false → removes customer data only
    - delete_customer=false, delete_business=true → removes shops & business data only
    - delete_customer=true, delete_business=true → permanently deletes everything + Firebase
    """
    result = await AuthService.delete_account(
        db,
        current_user.id,
        delete_customer=body.delete_customer,
        delete_business=body.delete_business,
    )
    return result


@router.post("/firebase-signin")
async def firebase_signin(
    body: FirebaseSignInRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create or sync a user record after Firebase authentication, then issue an
    internal HS256 JWT so the frontend can authenticate subsequent API calls
    without relying on the Firebase Admin SDK for every request.

    Flow:
      1. Verify Firebase ID token via Firebase Admin SDK
      2. Create a new User row on first sign-in, or update existing record
      3. Issue an internal access_token (HS256 JWT)
      4. Return user profile + access_token + metadata
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
