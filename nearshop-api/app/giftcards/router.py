"""Gift Cards Router"""
from uuid import UUID
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.giftcards.schemas import (
    PurchaseGiftCard, RedeemGiftCard, GiftCardResponse, GiftCardDetail,
    TransactionResponse, BalanceCheckResponse, TemplateResponse,
)
from app.giftcards.service import (
    purchase_gift_card, check_balance, redeem_gift_card,
    get_user_gift_cards, get_gift_card_detail, get_templates,
)

router = APIRouter(prefix="/api/v1/giftcards", tags=["giftcards"])


@router.post("/purchase", response_model=GiftCardResponse)
async def purchase(
    body: PurchaseGiftCard,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await purchase_gift_card(db, current_user.id, body)
    return GiftCardResponse(
        **{k: v for k, v in card.__dict__.items() if not k.startswith('_')},
        shop_name=card.shop.name if card.shop else None,
    )


@router.get("/check/{code}", response_model=BalanceCheckResponse)
async def check_card_balance(code: str, db: AsyncSession = Depends(get_db)):
    card = await check_balance(db, code)
    if not card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    
    return BalanceCheckResponse(
        code=card.code,
        current_balance=card.current_balance,
        status=card.status,
        shop_name=card.shop.name if card.shop else "Any Shop",
        expires_at=card.expires_at,
    )


@router.post("/redeem", response_model=GiftCardResponse)
async def redeem(
    body: RedeemGiftCard,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await redeem_gift_card(db, body.code, current_user.id, amount=body.amount)
    return GiftCardResponse(
        **{k: v for k, v in card.__dict__.items() if not k.startswith('_')},
        shop_name=card.shop.name if card.shop else None,
    )


@router.get("/my", response_model=list[GiftCardResponse])
async def list_my_cards(
    include_used: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cards = await get_user_gift_cards(db, current_user.id, include_used)
    return [GiftCardResponse(
        **{k: v for k, v in c.__dict__.items() if not k.startswith('_')},
        shop_name=c.shop.name if c.shop else None,
    ) for c in cards]


@router.get("/{card_id}", response_model=GiftCardDetail)
async def get_card(
    card_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await get_gift_card_detail(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    if card.purchased_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return GiftCardDetail(
        **{k: v for k, v in card.__dict__.items() if not k.startswith('_')},
        shop_name=card.shop.name if card.shop else None,
        transactions=[TransactionResponse.model_validate(t) for t in card.transactions],
    )


@router.get("/templates/{shop_id}", response_model=list[TemplateResponse])
async def list_templates(shop_id: Optional[UUID] = None, db: AsyncSession = Depends(get_db)):
    templates = await get_templates(db, shop_id)
    return [TemplateResponse.model_validate(t) for t in templates]
