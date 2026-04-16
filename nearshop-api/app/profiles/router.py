"""
API Router for User Profiles
Profile management, avatar upload, stats
"""

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
import uuid

from app.core.dependencies import get_db, get_current_user
from app.profiles.service import ProfileService
from app.schemas_missing_features import (
    UserProfileResponse,
    UserProfileUpdate,
    PublicProfileResponse,
)


router = APIRouter(
    prefix="/api/v1/profile",
    tags=["profile"],
    dependencies=[Depends(get_current_user)]
)


@router.get("", response_model=UserProfileResponse)
async def get_profile(
    db = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get current user's profile"""
    return await ProfileService.get_profile(
        db=db,
        user_id=current_user.id
    )


@router.put("", response_model=UserProfileResponse)
async def update_profile(
    profile_data: UserProfileUpdate,
    db = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update current user's profile"""
    return await ProfileService.update_profile(
        db=db,
        user_id=current_user.id,
        update_data=profile_data
    )


@router.post("/avatar", response_model=UserProfileResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Upload user avatar.
    
    Should integrate with S3 storage:
    - Save file to S3
    - Store URL and key in profile
    - Return updated profile
    
    File restrictions:
    - Max 5MB
    - JPEG/PNG only
    """
    # TODO: Implement S3 upload logic
    # For now, placeholder
    raise HTTPException(
        status_code=501,
        detail="Avatar upload not yet implemented - requires S3 integration"
    )


@router.delete("/avatar", response_model=UserProfileResponse)
async def delete_avatar(
    db = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Remove user's avatar"""
    return await ProfileService.delete_avatar(
        db=db,
        user_id=current_user.id
    )


@router.get("/public/{user_id}", response_model=PublicProfileResponse)
async def get_public_profile(
    user_id: uuid.UUID,
    db = Depends(get_db),
):
    """
    Get public view of another user's profile.
    Does not require authentication.
    Shows only: name, avatar, stats, badges
    """
    return await ProfileService.get_public_profile(
        db=db,
        user_id=user_id
    )


@router.post("/verify-phone", response_model=UserProfileResponse)
async def verify_phone(
    db = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Mark phone as verified (called by SMS verification flow)"""
    return await ProfileService.set_phone_verified(
        db=db,
        user_id=current_user.id
    )


@router.post("/verify-email", response_model=UserProfileResponse)
async def verify_email(
    db = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Mark email as verified (called by email verification flow)"""
    return await ProfileService.set_email_verified(
        db=db,
        user_id=current_user.id
    )
