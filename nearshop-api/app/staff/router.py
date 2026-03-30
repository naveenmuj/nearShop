"""Staff Router"""
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business
from app.staff.models import STAFF_ROLES
from app.staff.schemas import (
    StaffInvite, StaffUpdate, StaffResponse, StaffListResponse,
    ActivityLogResponse, AcceptInviteRequest,
)
from app.staff.service import (
    invite_staff, accept_invite, get_shop_staff, update_staff,
    remove_staff, get_activity_logs,
)
from app.shops.models import Shop

router = APIRouter(prefix="/api/v1/staff", tags=["staff"])


@router.get("/roles")
async def get_roles():
    return {"roles": [{"key": k, **v} for k, v in STAFF_ROLES.items()]}


@router.post("/invite", response_model=StaffResponse)
async def invite_staff_member(
    body: StaffInvite,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    staff = await invite_staff(db, shop_id, current_user.id, body)
    return StaffResponse.model_validate(staff)


@router.post("/accept", response_model=StaffResponse)
async def accept_staff_invite(
    body: AcceptInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    staff = await accept_invite(db, current_user.id, body.invite_code)
    return StaffResponse.model_validate(staff)


@router.get("", response_model=StaffListResponse)
async def list_staff(
    include_inactive: bool = False,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    staff_list = await get_shop_staff(db, shop_id, include_inactive)
    return StaffListResponse(
        items=[StaffResponse(
            **{k: v for k, v in s.__dict__.items() if not k.startswith('_')},
            user_avatar=s.user.avatar_url if s.user else None,
        ) for s in staff_list],
        total=len(staff_list),
    )


@router.patch("/{staff_id}", response_model=StaffResponse)
async def update_staff_member(
    staff_id: UUID, body: StaffUpdate,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    staff = await update_staff(db, staff_id, current_user.id, body)
    return StaffResponse.model_validate(staff)


@router.delete("/{staff_id}")
async def remove_staff_member(
    staff_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    success = await remove_staff(db, staff_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"message": "Staff removed"}


@router.get("/activity", response_model=list[ActivityLogResponse])
async def get_staff_activity(
    staff_id: Optional[UUID] = None, limit: int = 50,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    logs = await get_activity_logs(db, shop_id, staff_id, limit)
    return [ActivityLogResponse(
        **{k: v for k, v in l.__dict__.items() if not k.startswith('_')},
        staff_name=l.staff_member.name if l.staff_member else None,
    ) for l in logs]
