import logging
import os
import json
import urllib.error
import urllib.request

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, messaging

logger = logging.getLogger(__name__)

_firebase_initialized = False

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _looks_like_expo_push_token(token: str) -> bool:
    return bool(token) and (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken["))


def _normalize_data_payload(data: dict | None) -> dict:
    payload = {}
    for key, value in (data or {}).items():
        if value is None:
            continue
        payload[str(key)] = value if isinstance(value, str) else json.dumps(value, default=str)
    return payload


def _send_expo_push_notification(
    token: str,
    title: str,
    body: str,
    data: dict = None,
    image: str = None,
) -> str | None:
    payload = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": _normalize_data_payload(data),
    }
    if image:
        payload["image"] = image

    request = urllib.request.Request(
        EXPO_PUSH_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            response_body = json.loads(response.read().decode("utf-8"))
            logger.info("Expo push notification sent: %s", response_body)
            return response_body.get("data", {}).get("id") or response_body.get("id") or "expo-push-sent"
    except urllib.error.HTTPError as error:
        logger.error("Expo push notification failed: %s", error.read().decode("utf-8", errors="ignore"))
    except Exception as error:
        logger.error("Expo push notification error: %s", error)
    return None


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


# ═══════════════════════════════════════════════════════════════════════════════
# FIREBASE CLOUD MESSAGING - PUSH NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def send_push_notification(
    token: str,
    title: str,
    body: str,
    data: dict = None,
    image: str = None,
) -> str | None:
    """
    Send a push notification to a single device via FCM or Expo push.
    
    Args:
        token: FCM device token or Expo push token
        title: Notification title
        body: Notification body text
        data: Optional custom data payload
        image: Optional image URL
    
    Returns:
        Message ID on success, None on failure
    """
    get_firebase_app()
    
    try:
        if _looks_like_expo_push_token(token):
            return _send_expo_push_notification(token, title, body, data=data, image=image)

        notification = messaging.Notification(
            title=title,
            body=body,
            image=image,
        )
        
        message = messaging.Message(
            notification=notification,
            data=data or {},
            token=token,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    icon="notification_icon",
                    color="#6366f1",
                    click_action="FLUTTER_NOTIFICATION_CLICK",
                ),
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        badge=1,
                        sound="default",
                    ),
                ),
            ),
        )
        
        response = messaging.send(message)
        logger.info(f"Push notification sent: {response}")
        return response
    except messaging.UnregisteredError:
        logger.warning(f"FCM token is invalid or unregistered: {token[:20]}...")
        return None
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return None


def send_push_to_multiple(
    tokens: list[str],
    title: str,
    body: str,
    data: dict = None,
    image: str = None,
) -> dict:
    """
    Send push notification to multiple devices.
    
    Args:
        tokens: List of FCM device tokens or Expo push tokens
        title: Notification title
        body: Notification body text
        data: Optional custom data payload
        image: Optional image URL
    
    Returns:
        Dict with success_count, failure_count, and failed_tokens
    """
    get_firebase_app()
    
    if not tokens:
        return {"success_count": 0, "failure_count": 0, "failed_tokens": []}

    expo_tokens = [token for token in tokens if _looks_like_expo_push_token(token)]
    fcm_tokens = [token for token in tokens if not _looks_like_expo_push_token(token)]

    failed_tokens: list[str] = []
    success_count = 0

    for token in expo_tokens:
        if _send_expo_push_notification(token, title, body, data=data, image=image):
            success_count += 1
        else:
            failed_tokens.append(token)
    
    if not fcm_tokens:
        return {
            "success_count": success_count,
            "failure_count": len(failed_tokens),
            "failed_tokens": failed_tokens,
        }

    notification = messaging.Notification(
        title=title,
        body=body,
        image=image,
    )
    
    message = messaging.MulticastMessage(
        notification=notification,
        data=data or {},
        tokens=fcm_tokens,
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                icon="notification_icon",
                color="#6366f1",
            ),
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    badge=1,
                    sound="default",
                ),
            ),
        ),
    )
    
    try:
        response = messaging.send_each_for_multicast(message)
        
        for idx, result in enumerate(response.responses):
            if not result.success:
                failed_tokens.append(fcm_tokens[idx])
            else:
                success_count += 1
        
        logger.info(
            f"Multicast push: {success_count + response.success_count} succeeded, "
            f"{len(failed_tokens)} failed"
        )
        
        return {
            "success_count": success_count,
            "failure_count": len(failed_tokens),
            "failed_tokens": failed_tokens,
        }
    except Exception as e:
        logger.error(f"Error sending multicast push: {e}")
        return {
            "success_count": success_count,
            "failure_count": len(failed_tokens) + len(fcm_tokens),
            "failed_tokens": failed_tokens + fcm_tokens,
        }


def send_topic_notification(
    topic: str,
    title: str,
    body: str,
    data: dict = None,
    image: str = None,
) -> str | None:
    """
    Send a push notification to a topic (e.g., all users subscribed to a shop).
    
    Args:
        topic: Topic name (e.g., "shop_123", "deals", "all")
        title: Notification title
        body: Notification body text
        data: Optional custom data payload
        image: Optional image URL
    
    Returns:
        Message ID on success, None on failure
    """
    get_firebase_app()
    
    try:
        notification = messaging.Notification(
            title=title,
            body=body,
            image=image,
        )
        
        message = messaging.Message(
            notification=notification,
            data=data or {},
            topic=topic,
        )
        
        response = messaging.send(message)
        logger.info(f"Topic notification sent to {topic}: {response}")
        return response
    except Exception as e:
        logger.error(f"Error sending topic notification: {e}")
        return None
