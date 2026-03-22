import secrets
import string
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import phonenumbers
from jose import JWTError, jwt

from app.config import get_settings
from app.core.exceptions import UnauthorizedError, BadRequestError

settings = get_settings()


def create_access_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise UnauthorizedError("Invalid or expired token")


def verify_access_token(token: str) -> dict[str, Any]:
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type")
    return payload


def verify_refresh_token(token: str) -> dict[str, Any]:
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise UnauthorizedError("Invalid token type")
    return payload


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(6))


def generate_referral_code() -> str:
    """Generate a cryptographically secure 8-character referral code."""
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))


def hash_otp(otp: str, phone: str) -> str:
    """Hash OTP with phone number as salt for secure storage."""
    combined = f"{otp}:{phone}:{settings.JWT_SECRET_KEY}"
    return hashlib.sha256(combined.encode()).hexdigest()


def verify_otp_hash(otp: str, phone: str, hashed: str) -> bool:
    """Verify OTP against its hash."""
    return hash_otp(otp, phone) == hashed


def validate_phone(phone: str) -> str:
    try:
        parsed = phonenumbers.parse(phone, "IN")
        if not phonenumbers.is_valid_number(parsed):
            raise BadRequestError("Invalid phone number")
        return phonenumbers.format_number(
            parsed, phonenumbers.PhoneNumberFormat.E164
        )
    except phonenumbers.NumberParseException:
        raise BadRequestError("Invalid phone number format")
