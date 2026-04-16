"""
Service Layer for User Profiles
Extended user data, avatars, preferences, and stats
"""

from datetime import datetime
from typing import Optional
import uuid
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models_missing_features import UserProfile
from app.schemas_missing_features import (
    UserProfileUpdate,
    UserProfileResponse,
    PublicProfileResponse,
)
from app.core.exceptions import AppException


class ProfileService:
    """Service for managing user profiles"""
    
    @staticmethod
    async def create_or_get_profile(
        db: Session,
        user_id: uuid.UUID,
        display_name: Optional[str] = None
    ) -> UserProfileResponse:
        """Create profile if doesn't exist, or return existing"""
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if profile:
            return UserProfileResponse.from_orm(profile)
        
        # Create new profile
        profile = UserProfile(
            user_id=user_id,
            display_name=display_name,
            preferred_language="en",
            timezone="Asia/Kolkata",
            badges=[],
        )
        
        db.add(profile)
        db.commit()
        db.refresh(profile)
        
        return UserProfileResponse.from_orm(profile)
    
    @staticmethod
    async def get_profile(
        db: Session,
        user_id: uuid.UUID
    ) -> Optional[UserProfileResponse]:
        """Get user's profile"""
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise AppException(
                detail="User profile not found",
                error_code="PROFILE_NOT_FOUND",
                status_code=404
            )
        
        return UserProfileResponse.from_orm(profile)
    
    @staticmethod
    async def get_public_profile(
        db: Session,
        user_id: uuid.UUID
    ) -> Optional[PublicProfileResponse]:
        """Get public view of user profile"""
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise AppException(
                detail="User profile not found",
                error_code="PROFILE_NOT_FOUND",
                status_code=404
            )
        
        return PublicProfileResponse(
            id=profile.id,
            display_name=profile.display_name,
            avatar_url=profile.avatar_url,
            total_orders=profile.total_orders,
            avg_rating=profile.avg_rating,
            badges=profile.badges,
        )
    
    @staticmethod
    async def update_profile(
        db: Session,
        user_id: uuid.UUID,
        update_data: UserProfileUpdate
    ) -> UserProfileResponse:
        """Update user profile"""
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise AppException(
                detail="User profile not found",
                error_code="PROFILE_NOT_FOUND",
                status_code=404
            )
        
        # Update only provided fields
        update_dict = update_data.dict(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                setattr(profile, key, value)
        
        profile.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(profile)
        
        return UserProfileResponse.from_orm(profile)
    
    @staticmethod
    async def set_avatar(
        db: Session,
        user_id: uuid.UUID,
        avatar_url: str,
        avatar_key: Optional[str] = None
    ) -> UserProfileResponse:
        """Set user avatar (S3 URL)"""
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise AppException(
                detail="User profile not found",
                error_code="PROFILE_NOT_FOUND",
                status_code=404
            )
        
        # Store old key for cleanup
        old_avatar_key = profile.avatar_key
        
        # Update avatar
        profile.avatar_url = avatar_url
        profile.avatar_key = avatar_key
        profile.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(profile)
        
        return UserProfileResponse.from_orm(profile)
    
    @staticmethod
    async def delete_avatar(
        db: Session,
        user_id: uuid.UUID
    ) -> UserProfileResponse:
        """Remove user avatar"""
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise AppException(
                detail="User profile not found",
                error_code="PROFILE_NOT_FOUND",
                status_code=404
            )
        
        # Store key for cleanup
        avatar_key_to_delete = profile.avatar_key
        
        # Remove avatar
        profile.avatar_url = None
        profile.avatar_key = None
        profile.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(profile)
        
        return UserProfileResponse.from_orm(profile)
    
    @staticmethod
    async def add_badge(
        db: Session,
        user_id: uuid.UUID,
        badge_id: str
    ) -> UserProfileResponse:
        """Award badge to user"""
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise AppException(
                detail="User profile not found",
                error_code="PROFILE_NOT_FOUND",
                status_code=404
            )
        
        if not profile.badges:
            profile.badges = []
        
        if badge_id not in profile.badges:
            profile.badges.append(badge_id)
            profile.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(profile)
        
        return UserProfileResponse.from_orm(profile)
    
    @staticmethod
    async def update_stats(
        db: Session,
        user_id: uuid.UUID,
        total_orders: Optional[int] = None,
        total_spent: Optional[float] = None,
        avg_rating: Optional[float] = None,
    ) -> UserProfileResponse:
        """
        Update user stats (called from orders service)
        These are cached to avoid expensive calculations
        """
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise AppException(
                detail="User profile not found",
                error_code="PROFILE_NOT_FOUND",
                status_code=404
            )
        
        if total_orders is not None:
            profile.total_orders = total_orders
        
        if total_spent is not None:
            profile.total_spent = total_spent
        
        if avg_rating is not None:
            profile.avg_rating = avg_rating
        
        profile.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(profile)
        
        return UserProfileResponse.from_orm(profile)
    
    @staticmethod
    async def set_phone_verified(
        db: Session,
        user_id: uuid.UUID
    ) -> UserProfileResponse:
        """Mark phone as verified"""
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise AppException(
                detail="User profile not found",
                error_code="PROFILE_NOT_FOUND",
                status_code=404
            )
        
        profile.phone_verified_at = datetime.utcnow()
        profile.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(profile)
        
        return UserProfileResponse.from_orm(profile)
    
    @staticmethod
    async def set_email_verified(
        db: Session,
        user_id: uuid.UUID
    ) -> UserProfileResponse:
        """Mark email as verified"""
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise AppException(
                detail="User profile not found",
                error_code="PROFILE_NOT_FOUND",
                status_code=404
            )
        
        profile.email_verified_at = datetime.utcnow()
        profile.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(profile)
        
        return UserProfileResponse.from_orm(profile)
