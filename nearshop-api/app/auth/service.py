import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, OTPCode
from app.auth.schemas import CompleteProfileRequest, UserResponse
from app.core.exceptions import BadRequestError, NotFoundError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    generate_otp,
    generate_referral_code,
    validate_phone,
    hash_otp,
    verify_otp_hash,
)

logger = logging.getLogger(__name__)


class AuthService:

    @staticmethod
    async def send_otp(db: AsyncSession, phone: str) -> dict:
        validated_phone = validate_phone(phone)

        code = generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        # Hash the OTP for secure storage
        hashed_code = hash_otp(code, validated_phone)

        otp = OTPCode(
            phone=validated_phone,
            code=hashed_code,  # Store hashed version
            expires_at=expires_at,
        )
        db.add(otp)
        await db.flush()

        # In production, send via SMS gateway. For now, log to console.
        logger.info("OTP for %s: %s", validated_phone, code)
        print(f"[OTP] {validated_phone}: {code}")

        return {"message": "OTP sent successfully", "phone": validated_phone}

    @staticmethod
    async def verify_otp(db: AsyncSession, phone: str, code: str) -> dict:
        validated_phone = validate_phone(phone)

        # Fetch the latest OTP for this phone
        result = await db.execute(
            select(OTPCode)
            .where(OTPCode.phone == validated_phone)
            .order_by(OTPCode.created_at.desc())
            .limit(1)
        )
        otp_record = result.scalar_one_or_none()

        if otp_record is None:
            raise BadRequestError("No OTP found for this phone number. Request a new one.")

        # Check max attempts
        if otp_record.attempts >= 3:
            raise BadRequestError("Maximum OTP attempts exceeded. Request a new OTP.")

        # Increment attempts
        otp_record.attempts += 1
        await db.flush()

        # Check expiry
        now = datetime.now(timezone.utc)
        if otp_record.expires_at.tzinfo is None:
            expires = otp_record.expires_at.replace(tzinfo=timezone.utc)
        else:
            expires = otp_record.expires_at

        if now > expires:
            raise BadRequestError("OTP has expired. Request a new one.")

        # Validate code using hash comparison
        if not verify_otp_hash(code, validated_phone, otp_record.code):
            remaining = 3 - otp_record.attempts
            raise BadRequestError(
                f"Invalid OTP. {remaining} attempt(s) remaining."
            )

        # OTP is valid — delete it
        db.delete(otp_record)
        await db.flush()

        # Find or create user
        user_result = await db.execute(
            select(User).where(User.phone == validated_phone)
        )
        user = user_result.scalar_one_or_none()
        is_new_user = False

        if user is None:
            is_new_user = True
            referral = generate_referral_code()
            user = User(
                phone=validated_phone,
                referral_code=referral,
            )
            db.add(user)
            await db.flush()
            await db.refresh(user)

        # Generate tokens
        token_data = {"sub": str(user.id)}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user,
            "is_new_user": is_new_user,
        }

    @staticmethod
    async def refresh_token(db: AsyncSession, refresh_token_str: str) -> dict:
        payload = verify_refresh_token(refresh_token_str)

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Invalid token payload")

        result = await db.execute(
            select(User).where(User.id == UUID(user_id))
        )
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")
        if not user.is_active:
            raise UnauthorizedError("User account is deactivated")

        token_data = {"sub": str(user.id)}
        access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data)

        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user": user,
        }

    @staticmethod
    async def complete_profile(
        db: AsyncSession, user_id: UUID, data: CompleteProfileRequest
    ) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")

        user.name = data.name

        # Add role to roles array if not already present
        current_roles = list(user.roles or [])
        if data.role not in current_roles:
            current_roles.append(data.role)
            user.roles = current_roles

        user.active_role = data.role

        if data.interests is not None:
            user.interests = data.interests

        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def switch_role(db: AsyncSession, user_id: UUID, role: str) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")

        if role not in (user.roles or []):
            raise BadRequestError(
                f"Role '{role}' is not available. Your roles: {user.roles}"
            )

        user.active_role = role
        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def get_user(db: AsyncSession, user_id: UUID) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")

        return user
