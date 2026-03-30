"""Messaging Service"""
from uuid import UUID
from typing import Optional, List, Tuple
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, update
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
import logging

from app.messaging.models import Conversation, Message, MessageTemplate
from app.messaging.schemas import MessageCreate
from app.shops.models import Shop
from app.auth.models import User
from app.notifications.service import create_notification
from app.core.firebase import send_push_notification


logger = logging.getLogger(__name__)


def _display_name(user: User | None) -> str:
    if not user:
        return "User"
    return (
        getattr(user, "full_name", None)
        or getattr(user, "name", None)
        or getattr(user, "phone", None)
        or "User"
    )


async def _notify_message_recipient(
    db: AsyncSession,
    conversation: Conversation,
    sender_role: str,
    message: Message,
) -> None:
    preview = (message.content or "Sent an attachment").strip()[:120]

    try:
        if sender_role == "customer":
            owner_result = await db.execute(select(Shop.owner_id).where(Shop.id == conversation.shop_id))
            recipient_user_id = owner_result.scalar_one_or_none()
            if not recipient_user_id:
                return

            customer_result = await db.execute(select(User).where(User.id == conversation.customer_id))
            customer = customer_result.scalar_one_or_none()
            party_name = (customer.full_name if customer and hasattr(customer, "full_name") else None) or (customer.name if customer else None) or (customer.phone if customer else "Customer")
            target_role = "business"
        else:
            recipient_user_id = conversation.customer_id
            shop_result = await db.execute(select(Shop.name).where(Shop.id == conversation.shop_id))
            shop_name = shop_result.scalar_one_or_none() or "Shop"
            party_name = shop_name
            target_role = "customer"

        recipient_result = await db.execute(select(User).where(User.id == recipient_user_id))
        recipient = recipient_result.scalar_one_or_none()
        if not recipient:
            return

        await create_notification(
            db=db,
            user_id=recipient.id,
            notification_type="new_message",
            reference_type="conversation",
            reference_id=conversation.id,
            party_name=party_name,
            message_preview=preview,
        )

        if recipient.fcm_token:
            send_push_notification(
                token=recipient.fcm_token,
                title=f"New message from {party_name}",
                body=preview,
                data={
                    "type": "new_message",
                    "reference_type": "conversation",
                    "reference_id": str(conversation.id),
                    "target_role": target_role,
                    "sender_role": sender_role,
                },
            )
    except Exception as exc:
        logger.warning("Failed to send chat notification: %s", exc)


async def get_or_create_conversation(
    db: AsyncSession, customer_id: UUID, shop_id: UUID,
    product_id: Optional[UUID] = None, order_id: Optional[UUID] = None,
) -> Conversation:
    query = select(Conversation).where(and_(
        Conversation.customer_id == customer_id,
        Conversation.shop_id == shop_id,
        Conversation.status == "active",
    ))
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()
    
    if conversation:
        if product_id:
            conversation.product_id = product_id
        if order_id:
            conversation.order_id = order_id
        await db.commit()
        return conversation
    
    conversation = Conversation(
        customer_id=customer_id, shop_id=shop_id,
        product_id=product_id, order_id=order_id,
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def send_message(
    db: AsyncSession, conversation_id: UUID, sender_id: UUID,
    sender_role: str, message_data: MessageCreate,
) -> Message:
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    message = Message(
        conversation_id=conversation_id, sender_id=sender_id, sender_role=sender_role,
        content=message_data.content, message_type=message_data.message_type,
        attachments=message_data.attachments, message_metadata=message_data.metadata,
    )
    db.add(message)
    
    conversation.last_message_at = datetime.utcnow()
    if sender_role == "customer":
        conversation.shop_unread_count += 1
    else:
        conversation.customer_unread_count += 1

    await _notify_message_recipient(db, conversation, sender_role, message)
    
    await db.commit()
    await db.refresh(message)
    return message


async def get_conversation_messages(
    db: AsyncSession, conversation_id: UUID, user_id: UUID,
    limit: int = 50, before_id: Optional[UUID] = None,
) -> List[Message]:
    query = select(Message).where(Message.conversation_id == conversation_id)
    if before_id:
        cursor_result = await db.execute(select(Message.created_at).where(Message.id == before_id))
        cursor_time = cursor_result.scalar_one_or_none()
        if cursor_time:
            query = query.where(Message.created_at < cursor_time)
    query = query.order_by(desc(Message.created_at)).limit(limit)
    result = await db.execute(query)
    messages = list(result.scalars().all())
    return messages[::-1]


async def mark_messages_read(
    db: AsyncSession, conversation_id: UUID, reader_id: UUID, reader_role: str,
) -> int:
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = result.scalar_one_or_none()
    if not conversation:
        return 0
    
    update_query = update(Message).where(and_(
        Message.conversation_id == conversation_id,
        Message.sender_role != reader_role,
        Message.is_read == False,
    )).values(is_read=True, read_at=datetime.utcnow())
    result = await db.execute(update_query)
    
    if reader_role == "customer":
        conversation.customer_unread_count = 0
    else:
        conversation.shop_unread_count = 0
    
    await db.commit()
    return result.rowcount


async def get_user_conversations(
    db: AsyncSession, user_id: UUID, role: str, limit: int = 20, offset: int = 0,
) -> Tuple[List[dict], int]:
    if role == "customer":
        filter_clause = Conversation.customer_id == user_id
    else:
        shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == user_id))
        shop_ids = list(shop_result.scalars().all())
        if not shop_ids:
            return [], 0
        filter_clause = Conversation.shop_id.in_(shop_ids)
    
    count_query = select(func.count()).select_from(Conversation).where(filter_clause)
    total = (await db.execute(count_query)).scalar() or 0
    
    query = select(Conversation).where(filter_clause).options(
        selectinload(Conversation.customer),
        selectinload(Conversation.shop),
        selectinload(Conversation.product),
    ).order_by(desc(Conversation.last_message_at)).offset(offset).limit(limit)
    
    conversations = (await db.execute(query)).scalars().all()
    enriched = []
    
    for conv in conversations:
        msg_result = await db.execute(
            select(Message).where(Message.conversation_id == conv.id)
            .order_by(desc(Message.created_at)).limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()
        
        enriched.append({
            "id": conv.id, "customer_id": conv.customer_id, "shop_id": conv.shop_id,
            "product_id": conv.product_id, "order_id": conv.order_id, "status": conv.status,
            "last_message_at": conv.last_message_at, "created_at": conv.created_at,
            "unread_count": conv.customer_unread_count if role == "customer" else conv.shop_unread_count,
            "other_party_name": conv.shop.name if role == "customer" else _display_name(conv.customer),
            "other_party_avatar": conv.shop.logo_url if role == "customer" else conv.customer.avatar_url,
            "last_message_preview": last_msg.content[:100] if last_msg and last_msg.content else None,
            "shop_name": conv.shop.name,
            "product_name": conv.product.name if conv.product else None,
        })
    
    return enriched, total


async def get_shop_templates(db: AsyncSession, shop_id: UUID) -> List[MessageTemplate]:
    result = await db.execute(
        select(MessageTemplate).where(and_(
            MessageTemplate.shop_id == shop_id,
            MessageTemplate.is_active == True,
        )).order_by(desc(MessageTemplate.use_count))
    )
    return list(result.scalars().all())


async def create_template(
    db: AsyncSession, shop_id: UUID, title: str, content: str, category: Optional[str] = "general",
) -> MessageTemplate:
    template = MessageTemplate(shop_id=shop_id, title=title, content=content, category=category)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template
