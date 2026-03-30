"""Direct Messaging Router"""
from uuid import UUID
from typing import Dict, Set
import json
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db, get_async_session
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer
from app.core.security import decode_token
from app.messaging.schemas import (
    MessageCreate, MessageResponse, ConversationCreate,
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.messaging.models import Conversation
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await get_conversation_messages(db, conversation_id, current_user.id)
    return ConversationDetail(
        id=conversation.id, customer_id=conversation.customer_id, shop_id=conversation.shop_id,
        product_id=conversation.product_id, order_id=conversation.order_id, status=conversation.status,
        last_message_at=conversation.last_message_at, unread_count=0, created_at=conversation.created_at,
        messages=[MessageResponse.model_validate(m) for m in messages],
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def post_message(
    conversation_id: UUID, body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await send_message(db, conversation_id, current_user.id, current_user.active_role, body)
    await messaging_manager.broadcast(str(conversation_id), {
        "type": "new_message",
        "message": {"id": str(message.id), "sender_id": str(message.sender_id), "sender_role": message.sender_role,
                    "content": message.content, "message_type": message.message_type, "created_at": message.created_at.isoformat()}
    })
    return MessageResponse.model_validate(message)


@router.post("/conversations/{conversation_id}/read")
async def mark_read(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await mark_messages_read(db, conversation_id, current_user.id, current_user.active_role)
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
            role = "customer" if str(conversation.customer_id) == user_id else "shop"
        
        await websocket.send_json({"type": "connected", "conversation_id": conversation_id, "role": role})
        
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "message":
                async with get_async_session() as db:
                    message = await send_message(
                        db, UUID(conversation_id), UUID(user_id), role,
                        MessageCreate(content=data.get("content"), message_type=data.get("message_type", "text"))
                    )
                    await messaging_manager.broadcast(conversation_id, {
                        "type": "new_message",
                        "message": {"id": str(message.id), "sender_role": message.sender_role,
                                    "content": message.content, "created_at": message.created_at.isoformat()}
                    })
            elif msg_type == "typing":
                await messaging_manager.broadcast(conversation_id, {"type": "typing", "sender_role": role}, exclude=websocket)
            elif msg_type == "read":
                async with get_async_session() as db:
                    await mark_messages_read(db, UUID(conversation_id), UUID(user_id), role)
                    await messaging_manager.broadcast(conversation_id, {"type": "read", "by": role}, exclude=websocket)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        messaging_manager.disconnect(websocket, conversation_id)
