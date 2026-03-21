import logging
import os

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

logger = logging.getLogger(__name__)

_firebase_initialized = False


def get_firebase_app():
    global _firebase_initialized
    if _firebase_initialized:
        return firebase_admin.get_app()

    service_account_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "firebase-service-account.json",
    )

    if os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase initialized with service account")
    else:
        # Dev fallback: initialize with project ID only (token verification may be limited)
        # Download service account from Firebase Console → Project Settings → Service Accounts
        logger.warning(
            "firebase-service-account.json not found at %s. "
            "Firebase token verification will use project ID only. "
            "Download the service account JSON from Firebase Console for production use.",
            service_account_path,
        )
        firebase_admin.initialize_app(options={"projectId": "nearshop-af6a5"})

    _firebase_initialized = True
    return firebase_admin.get_app()


def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims."""
    get_firebase_app()
    try:
        decoded = firebase_auth.verify_id_token(id_token)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        from app.core.exceptions import UnauthorizedError
        raise UnauthorizedError("Firebase token has expired")
    except firebase_auth.InvalidIdTokenError as e:
        from app.core.exceptions import UnauthorizedError
        raise UnauthorizedError(f"Invalid Firebase token: {e}")
    except Exception as e:
        from app.core.exceptions import UnauthorizedError
        raise UnauthorizedError(f"Token verification failed: {e}")
