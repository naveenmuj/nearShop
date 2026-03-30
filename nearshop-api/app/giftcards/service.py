"""Gift Cards Service"""
from uuid import UUID
from typing import Optional, List
from datetime import datetime, timedelta
from decimal import Decimal
import secrets
import string

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.giftcards.models import GiftCard, GiftCardTransaction, GiftCardTemplate
from app.giftcards.schemas import PurchaseGiftCard


def generate_gift_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return '-'.join(''.join(secrets.choice(chars) for _ in range(4)) for _ in range(3))


async def purchase_gift_card(
    db: AsyncSession, user_id: UUID, data: PurchaseGiftCard,
) -> GiftCard:
    code = generate_gift_code()
    
    # Ensure unique code
    while True:
        existing = await db.execute(select(GiftCard).where(GiftCard.code == code))
        if not existing.scalar_one_or_none():
            break
        code = generate_gift_code()
    
    card = GiftCard(
        code=code,
        card_type="shop" if data.shop_id else "platform",
        shop_id=data.shop_id,
        initial_value=data.value,
        current_balance=data.value,
        purchased_by=user_id,
        recipient_email=data.recipient_email,
        recipient_phone=data.recipient_phone,
        recipient_name=data.recipient_name,
        personal_message=data.personal_message,
        template_id=data.template_id,
        purchased_at=datetime.utcnow(),
        activated_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=365),
    )
    db.add(card)
    await db.flush()
    
    # Record purchase transaction
    transaction = GiftCardTransaction(
        gift_card_id=card.id,
        transaction_type="purchase",
        amount=data.value,
        balance_before=Decimal(0),
        balance_after=data.value,
        user_id=user_id,
        notes="Gift card purchased",
    )
    db.add(transaction)
    
    await db.commit()
    await db.refresh(card)
    return card


async def check_balance(db: AsyncSession, code: str) -> Optional[GiftCard]:
    result = await db.execute(
        select(GiftCard).where(GiftCard.code == code.upper().replace("-", ""))
        .options(selectinload(GiftCard.shop))
    )
    card = result.scalar_one_or_none()
    
    # Also try with dashes
    if not card:
        result = await db.execute(
            select(GiftCard).where(GiftCard.code == code.upper())
            .options(selectinload(GiftCard.shop))
        )
        card = result.scalar_one_or_none()
    
    return card


async def redeem_gift_card(
    db: AsyncSession, code: str, user_id: UUID, order_id: Optional[UUID] = None,
    amount: Optional[Decimal] = None,
) -> GiftCard:
    card = await check_balance(db, code)
    if not card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    
    if card.status != "active":
        raise HTTPException(status_code=400, detail=f"Gift card is {card.status}")
    
    if card.expires_at and card.expires_at < datetime.utcnow():
        card.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="Gift card has expired")
    
    redeem_amount = amount if amount else card.current_balance
    if redeem_amount > card.current_balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    balance_before = card.current_balance
    card.current_balance -= redeem_amount
    
    if card.current_balance <= 0:
        card.status = "redeemed"
    
    transaction = GiftCardTransaction(
        gift_card_id=card.id,
        transaction_type="redeem",
        amount=redeem_amount,
        balance_before=balance_before,
        balance_after=card.current_balance,
        order_id=order_id,
        user_id=user_id,
    )
    db.add(transaction)
    
    await db.commit()
    await db.refresh(card)
    return card


async def get_user_gift_cards(
    db: AsyncSession, user_id: UUID, include_used: bool = False,
) -> List[GiftCard]:
    query = select(GiftCard).where(GiftCard.purchased_by == user_id)
    if not include_used:
        query = query.where(GiftCard.status == "active")
    query = query.options(selectinload(GiftCard.shop))
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_gift_card_detail(db: AsyncSession, card_id: UUID) -> Optional[GiftCard]:
    result = await db.execute(
        select(GiftCard).where(GiftCard.id == card_id)
        .options(selectinload(GiftCard.transactions), selectinload(GiftCard.shop))
    )
    return result.scalar_one_or_none()


async def get_templates(db: AsyncSession, shop_id: Optional[UUID] = None) -> List[GiftCardTemplate]:
    query = select(GiftCardTemplate).where(GiftCardTemplate.is_active == True)
    if shop_id:
        query = query.where((GiftCardTemplate.shop_id == shop_id) | (GiftCardTemplate.shop_id == None))
    else:
        query = query.where(GiftCardTemplate.shop_id == None)
    result = await db.execute(query)
    return list(result.scalars().all())
