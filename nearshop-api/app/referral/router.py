from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.loyalty.service import earn_coins

router = APIRouter(prefix="/api/v1/referral", tags=["referral"])


@router.get("/code")
async def get_my_referral_code(
    current_user: User = Depends(get_current_user),
):
    """Get the current user's referral code."""
    return {"referral_code": current_user.referral_code}


@router.get("/stats")
async def get_referral_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """How many users this user has referred."""
    result = await db.execute(
        select(func.count()).select_from(User).where(User.referred_by == current_user.id)
    )
    count = result.scalar() or 0
    return {
        "referral_code": current_user.referral_code,
        "total_referrals": count,
        "coins_per_referral": 50,
        "total_coins_earned": count * 50,
    }


@router.post("/apply")
async def apply_referral_code(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a referral code (one-time, at onboarding)."""
    if current_user.referred_by:
        raise HTTPException(status_code=400, detail="Referral code already applied")

    result = await db.execute(select(User).where(User.referral_code == code))
    referrer = result.scalar_one_or_none()
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    if referrer.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot use your own referral code")

    current_user.referred_by = referrer.id

    # Award coins to referrer
    await earn_coins(db, referrer.id, 50, "referral_bonus", reference_id=str(current_user.id))
    # Award coins to new user
    await earn_coins(db, current_user.id, 20, "referral_welcome", reference_id=str(referrer.id))

    await db.commit()
    return {"message": "Referral applied successfully", "coins_earned": 20}
