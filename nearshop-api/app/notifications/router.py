from uuid import UUID
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business
from app.notifications.service import (
    get_notifications,
    mark_read,
    mark_all_read,
    get_unread_count,
)
from app.core.firebase import (
    send_push_notification,
    send_push_to_multiple,
    send_topic_notification,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


# ═══════════════════════════════════════════════════════════════════════════════
# FCM TOKEN SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class RegisterTokenRequest(BaseModel):
    fcm_token: str
    device_type: str = "mobile"  # 'mobile', 'web'
    device_name: Optional[str] = None


class SendPushRequest(BaseModel):
    user_ids: Optional[List[str]] = None  # If None, send to all followers
    title: str
    body: str
    data: Optional[dict] = None
    image: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("")
async def list_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated notifications for the authenticated user."""
    items = await get_notifications(db, current_user.id, page, per_page)
    return {
        "items": [
            {
                "id": str(n.id),
                "title": n.title,
                "body": n.body,
                "notification_type": n.notification_type,
                "reference_type": n.reference_type,
                "reference_id": str(n.reference_id) if n.reference_id else None,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
        "page": page,
        "per_page": per_page,
    }


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read."""
    notification = await mark_read(db, notification_id, current_user.id)
    return {
        "id": str(notification.id),
        "is_read": notification.is_read,
    }


@router.put("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all unread notifications as read."""
    count = await mark_all_read(db, current_user.id)
    return {"marked_read": count}


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread notifications."""
    count = await get_unread_count(db, current_user.id)
    return {"unread_count": count}


# ═══════════════════════════════════════════════════════════════════════════════
# PUSH NOTIFICATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/register-token")
async def register_fcm_token(
    body: RegisterTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Register FCM token for push notifications.
    Call this when app starts or token refreshes.
    """
    # Update user's FCM token
    current_user.fcm_token = body.fcm_token
    current_user.fcm_device_type = body.device_type
    current_user.updated_at = datetime.utcnow()
    await db.commit()
    
    return {
        "status": "success",
        "message": "FCM token registered",
    }


@router.delete("/unregister-token")
async def unregister_fcm_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Unregister FCM token (e.g., on logout).
    """
    current_user.fcm_token = None
    current_user.updated_at = datetime.utcnow()
    await db.commit()
    
    return {
        "status": "success",
        "message": "FCM token unregistered",
    }


@router.post("/send-push")
async def send_push_to_users(
    body: SendPushRequest,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Send push notification to specific users or shop followers.
    Business owners can notify their customers.
    """
    from app.shops.models import Shop
    from app.engagement.models import ShopFollower
    
    # Get shop for current user
    shop_result = await db.execute(
        select(Shop).where(Shop.owner_id == current_user.id).limit(1)
    )
    shop = shop_result.scalar_one_or_none()
    
    if not shop:
        raise HTTPException(status_code=400, detail="No shop found for this user")
    
    # Get tokens
    tokens = []
    
    if body.user_ids:
        # Send to specific users
        result = await db.execute(
            select(User.fcm_token).where(
                User.id.in_([UUID(uid) for uid in body.user_ids]),
                User.fcm_token.isnot(None),
            )
        )
        tokens = [row[0] for row in result.all()]
    else:
        # Send to all shop followers
        result = await db.execute(
            select(User.fcm_token)
            .join(ShopFollower, ShopFollower.user_id == User.id)
            .where(
                ShopFollower.shop_id == shop.id,
                User.fcm_token.isnot(None),
            )
        )
        tokens = [row[0] for row in result.all()]
    
    if not tokens:
        return {
            "status": "no_recipients",
            "message": "No users with push tokens found",
            "sent": 0,
            "failed": 0,
        }
    
    # Send notifications
    result = send_push_to_multiple(
        tokens=tokens,
        title=body.title,
        body=body.body,
        data=body.data or {"shop_id": str(shop.id)},
        image=body.image,
    )
    
    return {
        "status": "success",
        "sent": result["success_count"],
        "failed": result["failure_count"],
        "total_targets": len(tokens),
    }


@router.post("/test-push")
async def test_push_notification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a test push notification to current user's device.
    """
    if not current_user.fcm_token:
        raise HTTPException(status_code=400, detail="No FCM token registered. Please register your device first.")
    
    result = send_push_notification(
        token=current_user.fcm_token,
        title="Test Notification 🔔",
        body="This is a test push notification from NearShop!",
        data={"type": "test", "timestamp": datetime.utcnow().isoformat()},
    )
    
    if result:
        return {
            "status": "success",
            "message": "Test notification sent",
            "message_id": result,
        }
    else:
        return {
            "status": "failed",
            "message": "Failed to send test notification. Token may be invalid.",
        }
