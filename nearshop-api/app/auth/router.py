from fastapi import APIRouter, Depends, Request, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User, UserAddress
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


# ═══════════════════════════════════════════════════════════════════════════════
# ADDRESS SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class AddressCreate(BaseModel):
    label: str = "home"  # 'home', 'work', 'other'
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    pincode: str
    landmark: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool = False


class AddressResponse(BaseModel):
    id: str
    label: str
    full_name: Optional[str]
    phone: Optional[str]
    address_line1: str
    address_line2: Optional[str]
    city: str
    state: Optional[str]
    pincode: str
    landmark: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    is_default: bool
    formatted_address: str

    class Config:
        from_attributes = True


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


# ═══════════════════════════════════════════════════════════════════════════════
# ADDRESS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

def format_address(addr: UserAddress) -> str:
    """Format address as a single string"""
    parts = [addr.address_line1]
    if addr.address_line2:
        parts.append(addr.address_line2)
    if addr.landmark:
        parts.append(f"Near {addr.landmark}")
    parts.append(f"{addr.city} - {addr.pincode}")
    if addr.state:
        parts.append(addr.state)
    return ", ".join(parts)


@router.post("/addresses", response_model=AddressResponse)
async def create_address(
    body: AddressCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new saved address."""
    # If this is the default address, unset other defaults
    if body.is_default:
        result = await db.execute(
            select(UserAddress).where(
                UserAddress.user_id == current_user.id,
                UserAddress.is_default == True
            )
        )
        for addr in result.scalars().all():
            addr.is_default = False
    
    address = UserAddress(
        user_id=current_user.id,
        label=body.label,
        full_name=body.full_name or current_user.name,
        phone=body.phone or current_user.phone,
        address_line1=body.address_line1,
        address_line2=body.address_line2,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
        landmark=body.landmark,
        latitude=body.latitude,
        longitude=body.longitude,
        is_default=body.is_default,
    )
    db.add(address)
    await db.commit()
    await db.refresh(address)
    
    return AddressResponse(
        id=str(address.id),
        label=address.label,
        full_name=address.full_name,
        phone=address.phone,
        address_line1=address.address_line1,
        address_line2=address.address_line2,
        city=address.city,
        state=address.state,
        pincode=address.pincode,
        landmark=address.landmark,
        latitude=address.latitude,
        longitude=address.longitude,
        is_default=address.is_default,
        formatted_address=format_address(address),
    )


@router.get("/addresses", response_model=list[AddressResponse])
async def list_addresses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all saved addresses for the current user."""
    result = await db.execute(
        select(UserAddress)
        .where(UserAddress.user_id == current_user.id)
        .order_by(UserAddress.is_default.desc(), UserAddress.created_at.desc())
    )
    addresses = result.scalars().all()
    
    return [
        AddressResponse(
            id=str(addr.id),
            label=addr.label,
            full_name=addr.full_name,
            phone=addr.phone,
            address_line1=addr.address_line1,
            address_line2=addr.address_line2,
            city=addr.city,
            state=addr.state,
            pincode=addr.pincode,
            landmark=addr.landmark,
            latitude=addr.latitude,
            longitude=addr.longitude,
            is_default=addr.is_default,
            formatted_address=format_address(addr),
        )
        for addr in addresses
    ]


@router.get("/addresses/{address_id}", response_model=AddressResponse)
async def get_address(
    address_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific address."""
    result = await db.execute(
        select(UserAddress).where(
            UserAddress.id == address_id,
            UserAddress.user_id == current_user.id
        )
    )
    address = result.scalar_one_or_none()
    
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    return AddressResponse(
        id=str(address.id),
        label=address.label,
        full_name=address.full_name,
        phone=address.phone,
        address_line1=address.address_line1,
        address_line2=address.address_line2,
        city=address.city,
        state=address.state,
        pincode=address.pincode,
        landmark=address.landmark,
        latitude=address.latitude,
        longitude=address.longitude,
        is_default=address.is_default,
        formatted_address=format_address(address),
    )


@router.put("/addresses/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: UUID,
    body: AddressCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a saved address."""
    result = await db.execute(
        select(UserAddress).where(
            UserAddress.id == address_id,
            UserAddress.user_id == current_user.id
        )
    )
    address = result.scalar_one_or_none()
    
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    # If setting as default, unset other defaults
    if body.is_default and not address.is_default:
        others_result = await db.execute(
            select(UserAddress).where(
                UserAddress.user_id == current_user.id,
                UserAddress.is_default == True,
                UserAddress.id != address_id
            )
        )
        for addr in others_result.scalars().all():
            addr.is_default = False
    
    # Update fields
    address.label = body.label
    address.full_name = body.full_name
    address.phone = body.phone
    address.address_line1 = body.address_line1
    address.address_line2 = body.address_line2
    address.city = body.city
    address.state = body.state
    address.pincode = body.pincode
    address.landmark = body.landmark
    address.latitude = body.latitude
    address.longitude = body.longitude
    address.is_default = body.is_default
    
    await db.commit()
    await db.refresh(address)
    
    return AddressResponse(
        id=str(address.id),
        label=address.label,
        full_name=address.full_name,
        phone=address.phone,
        address_line1=address.address_line1,
        address_line2=address.address_line2,
        city=address.city,
        state=address.state,
        pincode=address.pincode,
        landmark=address.landmark,
        latitude=address.latitude,
        longitude=address.longitude,
        is_default=address.is_default,
        formatted_address=format_address(address),
    )


@router.delete("/addresses/{address_id}")
async def delete_address(
    address_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved address."""
    result = await db.execute(
        select(UserAddress).where(
            UserAddress.id == address_id,
            UserAddress.user_id == current_user.id
        )
    )
    address = result.scalar_one_or_none()
    
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    await db.delete(address)
    await db.commit()
    
    return {"message": "Address deleted"}


@router.post("/addresses/{address_id}/set-default", response_model=AddressResponse)
async def set_default_address(
    address_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set an address as the default."""
    result = await db.execute(
        select(UserAddress).where(
            UserAddress.id == address_id,
            UserAddress.user_id == current_user.id
        )
    )
    address = result.scalar_one_or_none()
    
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    # Unset other defaults
    others_result = await db.execute(
        select(UserAddress).where(
            UserAddress.user_id == current_user.id,
            UserAddress.is_default == True
        )
    )
    for addr in others_result.scalars().all():
        addr.is_default = False
    
    address.is_default = True
    await db.commit()
    await db.refresh(address)
    
    return AddressResponse(
        id=str(address.id),
        label=address.label,
        full_name=address.full_name,
        phone=address.phone,
        address_line1=address.address_line1,
        address_line2=address.address_line2,
        city=address.city,
        state=address.state,
        pincode=address.pincode,
        landmark=address.landmark,
        latitude=address.latitude,
        longitude=address.longitude,
        is_default=address.is_default,
        formatted_address=format_address(address),
    )
