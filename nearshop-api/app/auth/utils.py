import logging
import re
from typing import Any, Optional
from uuid import UUID

import phonenumbers
from jose import JWTError

from app.config import get_settings
from app.core.security import decode_token

settings = get_settings()
logger = logging.getLogger(__name__)


def extract_user_id_from_token(token: str) -> Optional[UUID]:
    """Decode a JWT and return the user UUID without raising on failure.

    Returns ``None`` when the token is invalid, expired, or does not contain
    a ``sub`` claim.  This is handy in middleware or optional-auth flows where
    an exception is not desirable.
    """
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        sub = payload.get("sub")
        if sub is None:
            return None
        return UUID(sub)
    except (JWTError, ValueError, Exception):
        return None


def extract_token_payload(token: str) -> Optional[dict[str, Any]]:
    """Return the full JWT payload or ``None`` if the token is invalid."""
    try:
        return decode_token(token)
    except Exception:
        return None


def format_phone_number(phone: str, country_code: str = "IN") -> Optional[str]:
    """Parse and format a phone number to E.164 without raising.

    Returns the formatted string on success or ``None`` on any parse/validation
    failure.  Unlike ``validate_phone`` in ``core.security`` this helper never
    raises an exception, making it suitable for best-effort formatting in
    non-critical paths (e.g. logging, analytics).
    """
    try:
        parsed = phonenumbers.parse(phone, country_code)
        if not phonenumbers.is_valid_number(parsed):
            return None
        return phonenumbers.format_number(
            parsed, phonenumbers.PhoneNumberFormat.E164
        )
    except phonenumbers.NumberParseException:
        return None


def mask_phone(phone: str) -> str:
    """Return a masked version of a phone number for safe logging.

    Example: ``+919876543210`` -> ``+91*****3210``
    """
    digits_only = re.sub(r"\D", "", phone)
    if len(digits_only) <= 4:
        return "****"
    return phone[: 3] + "*" * (len(phone) - 7) + phone[-4:]
