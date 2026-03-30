"""Direct Messaging Router"""
from uuid import UUID
from typing import Dict, Set
import json
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db, get_async_session
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer
from app.core.security import decode_token
from app.messaging.schemas import (
    MessageCreate, MessageResponse, ConversationCreate, BusinessConversationCreate,
    ConversationSummary, ConversationDetail, ConversationListResponse,
    TemplateCreate, TemplateResponse,
)
from app.messaging.service import (
    get_or_create_conversation, send_message, get_conversation_messages,
    mark_messages_read, get_user_conversations, get_shop_templates, create_template,
)
from app.shops.models import Shop

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/messaging", tags=["messaging"])


async def _resolve_sender_role(db: AsyncSession, conversation, user_id: UUID) -> str | None:
    if conversation.customer_id == user_id:
        return "customer"

    shop_owner_result = await db.execute(select(Shop.owner_id).where(Shop.id == conversation.shop_id))
    shop_owner_id = shop_owner_result.scalar_one_or_none()
    if shop_owner_id == user_id:
        return "business"

    return None


def _user_display_name(user) -> str:
    return (
        getattr(user, "full_name", None)
        or getattr(user, "name", None)
        or getattr(user, "phone", None)
        or "User"
    )


class MessagingConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, conversation_id: str, user_id: str):
        await websocket.accept()
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = set()
        self.active_connections[conversation_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, conversation_id: str):
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].discard(websocket)
    
    async def broadcast(self, conversation_id: str, message: dict, exclude: WebSocket = None):
        if conversation_id in self.active_connections:
            for conn in list(self.active_connections[conversation_id]):
                if conn != exclude:
                    try:
                        await conn.send_json(message)
                    except:
                        self.active_connections[conversation_id].discard(conn)


messaging_manager = MessagingConnectionManager()


@router.post("/conversations", response_model=ConversationSummary)
async def create_conversation(
    body: ConversationCreate,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    conversation = await get_or_create_conversation(
        db, current_user.id, body.shop_id, body.product_id, body.order_id,
    )
    if body.initial_message:
        await send_message(db, conversation.id, current_user.id, "customer", MessageCreate(content=body.initial_message))
    return ConversationSummary(
        id=conversation.id, customer_id=conversation.customer_id, shop_id=conversation.shop_id,
        product_id=conversation.product_id, order_id=conversation.order_id, status=conversation.status,
        last_message_at=conversation.last_message_at, unread_count=0, created_at=conversation.created_at,
    )


@router.post("/conversations/business", response_model=ConversationSummary)
async def create_conversation_as_business(
    body: BusinessConversationCreate,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    from app.auth.models import User as UserModel

    customer_result = await db.execute(select(UserModel).where(UserModel.id == body.customer_id))
    customer = customer_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if body.shop_id:
        shop_result = await db.execute(select(Shop).where(Shop.id == body.shop_id, Shop.owner_id == current_user.id))
        shop = shop_result.scalar_one_or_none()
    else:
        owned_shops = await db.execute(select(Shop).where(Shop.owner_id == current_user.id).order_by(Shop.created_at.asc()))
        shop = owned_shops.scalars().first()

    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found for current business user")

    conversation = await get_or_create_conversation(
        db, body.customer_id, shop.id, body.product_id, body.order_id,
    )

    if body.initial_message:
        await send_message(db, conversation.id, current_user.id, "business", MessageCreate(content=body.initial_message))

    return ConversationSummary(
        id=conversation.id, customer_id=conversation.customer_id, shop_id=conversation.shop_id,
        product_id=conversation.product_id, order_id=conversation.order_id, status=conversation.status,
        last_message_at=conversation.last_message_at, unread_count=0, created_at=conversation.created_at,
    )


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    limit: int = 20, offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversations, total = await get_user_conversations(db, current_user.id, current_user.active_role, limit, offset)
    return ConversationListResponse(items=[ConversationSummary(**c) for c in conversations], total=total)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: UUID,
    limit: int = Query(default=30, ge=1, le=100),
    before_id: UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.messaging.models import Conversation
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(
            selectinload(Conversation.customer),
            selectinload(Conversation.shop),
            selectinload(Conversation.product),
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    sender_role = await _resolve_sender_role(db, conversation, current_user.id)
    if not sender_role:
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")
    
    paged_messages = await get_conversation_messages(db, conversation_id, current_user.id, limit=limit + 1, before_id=before_id)
    messages_has_more = len(paged_messages) > limit
    messages = paged_messages[1:] if messages_has_more else paged_messages
    messages_next_before_id = messages[0].id if messages_has_more and messages else None
    unread_count = conversation.customer_unread_count if sender_role == "customer" else conversation.shop_unread_count
    other_party_name = conversation.shop.name if sender_role == "customer" else _user_display_name(conversation.customer)
    other_party_avatar = conversation.shop.logo_url if sender_role == "customer" else conversation.customer.avatar_url
    return ConversationDetail(
        id=conversation.id, customer_id=conversation.customer_id, shop_id=conversation.shop_id,
        product_id=conversation.product_id, order_id=conversation.order_id, status=conversation.status,
        last_message_at=conversation.last_message_at, unread_count=unread_count, created_at=conversation.created_at,
        other_party_name=other_party_name, other_party_avatar=other_party_avatar,
        shop_name=conversation.shop.name, product_name=conversation.product.name if conversation.product else None,
        messages=[MessageResponse.model_validate(m) for m in messages],
        messages_has_more=messages_has_more,
        messages_next_before_id=messages_next_before_id,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def post_message(
    conversation_id: UUID, body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.messaging.models import Conversation
    conversation_result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = conversation_result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    sender_role = await _resolve_sender_role(db, conversation, current_user.id)
    if not sender_role:
        raise HTTPException(status_code=403, detail="Not authorized to post in this conversation")

    message = await send_message(db, conversation_id, current_user.id, sender_role, body)
    await messaging_manager.broadcast(str(conversation_id), {
        "type": "new_message",
        "message": {"id": str(message.id), "sender_id": str(message.sender_id), "sender_role": message.sender_role,
                    "content": message.content, "message_type": message.message_type,
                    "attachments": message.attachments, "created_at": message.created_at.isoformat()}
    })
    return MessageResponse.model_validate(message)


@router.post("/conversations/{conversation_id}/read")
async def mark_read(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.messaging.models import Conversation
    conversation_result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = conversation_result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    reader_role = await _resolve_sender_role(db, conversation, current_user.id)
    if not reader_role:
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")

    count = await mark_messages_read(db, conversation_id, current_user.id, reader_role)
    return {"marked_read": count}


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates(
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    templates = await get_shop_templates(db, shop_id)
    return [TemplateResponse.model_validate(t) for t in templates]


@router.post("/templates", response_model=TemplateResponse)
async def create_message_template(
    body: TemplateCreate,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    template = await create_template(db, shop_id, body.title, body.content, body.category)
    return TemplateResponse.model_validate(template)


@router.websocket("/ws/{conversation_id}")
async def messaging_websocket(websocket: WebSocket, conversation_id: str, token: str = Query(...)):
    user_id = None
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
        user_uuid = UUID(user_id)
    except:
        await websocket.close(code=4001)
        return
    
    await messaging_manager.connect(websocket, conversation_id, user_id)
    
    try:
        async with get_async_session() as db:
            from app.messaging.models import Conversation
            result = await db.execute(select(Conversation).where(Conversation.id == UUID(conversation_id)))
            conversation = result.scalar_one_or_none()
            if not conversation:
                await websocket.close(code=4004)
                return

            if conversation.customer_id == user_uuid:
                role = "customer"
            else:
                shop_owner_result = await db.execute(select(Shop.owner_id).where(Shop.id == conversation.shop_id))
                shop_owner_id = shop_owner_result.scalar_one_or_none()
                if shop_owner_id != user_uuid:
                    await websocket.close(code=4003)
                    return
                role = "business"
        
        await websocket.send_json({"type": "connected", "conversation_id": conversation_id, "role": role})
        
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "message":
                async with get_async_session() as db:
                    message = await send_message(
                        db, UUID(conversation_id), user_uuid, role,
                        MessageCreate(content=data.get("content"), message_type=data.get("message_type", "text"))
                    )
                    await messaging_manager.broadcast(conversation_id, {
                        "type": "new_message",
                        "message": {"id": str(message.id), "sender_role": message.sender_role,
                                    "content": message.content, "message_type": message.message_type,
                                    "attachments": message.attachments, "created_at": message.created_at.isoformat()}
                    })
            elif msg_type == "typing":
                await messaging_manager.broadcast(conversation_id, {"type": "typing", "sender_role": role}, exclude=websocket)
            elif msg_type == "read":
                async with get_async_session() as db:
                    await mark_messages_read(db, UUID(conversation_id), user_uuid, role)
                    await messaging_manager.broadcast(conversation_id, {"type": "read", "by": role}, exclude=websocket)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        messaging_manager.disconnect(websocket, conversation_id)
