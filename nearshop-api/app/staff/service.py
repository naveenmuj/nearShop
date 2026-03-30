"""Staff Service"""
from uuid import UUID
from typing import Optional, List, Tuple
from datetime import datetime, timedelta
import secrets

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.staff.models import StaffMember, StaffActivityLog, STAFF_ROLES
from app.staff.schemas import StaffInvite, StaffUpdate


async def invite_staff(
    db: AsyncSession, shop_id: UUID, owner_id: UUID, data: StaffInvite,
) -> StaffMember:
    # Check if already invited
    existing = None
    if data.email:
        existing = await db.execute(select(StaffMember).where(and_(
            StaffMember.shop_id == shop_id, StaffMember.email == data.email,
            StaffMember.status.notin_(["removed"]),
        )))
    elif data.phone:
        existing = await db.execute(select(StaffMember).where(and_(
            StaffMember.shop_id == shop_id, StaffMember.phone == data.phone,
            StaffMember.status.notin_(["removed"]),
        )))
    
    if existing and existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Staff already invited")
    
    invite_code = secrets.token_urlsafe(16)
    staff = StaffMember(
        shop_id=shop_id, name=data.name, email=data.email, phone=data.phone,
        role=data.role, permissions=data.permissions, invite_code=invite_code,
        invite_expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(staff)
    await db.commit()
    await db.refresh(staff)
    return staff


async def accept_invite(db: AsyncSession, user_id: UUID, invite_code: str) -> StaffMember:
    result = await db.execute(select(StaffMember).where(StaffMember.invite_code == invite_code))
    staff = result.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    if staff.status != "invited":
        raise HTTPException(status_code=400, detail="Invite already used")
    if staff.invite_expires_at and staff.invite_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invite expired")
    
    staff.user_id = user_id
    staff.status = "active"
    staff.joined_at = datetime.utcnow()
    staff.invite_code = None
    
    await db.commit()
    await db.refresh(staff)
    return staff


async def get_shop_staff(
    db: AsyncSession, shop_id: UUID, include_inactive: bool = False,
) -> List[StaffMember]:
    query = select(StaffMember).where(StaffMember.shop_id == shop_id)
    if not include_inactive:
        query = query.where(StaffMember.status.notin_(["removed"]))
    query = query.options(selectinload(StaffMember.user)).order_by(StaffMember.created_at)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_staff(
    db: AsyncSession, staff_id: UUID, owner_id: UUID, data: StaffUpdate,
) -> StaffMember:
    result = await db.execute(select(StaffMember).where(StaffMember.id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    if data.name:
        staff.name = data.name
    if data.role:
        staff.role = data.role
    if data.permissions is not None:
        staff.permissions = data.permissions
    if data.status:
        staff.status = data.status
    
    await db.commit()
    await db.refresh(staff)
    return staff


async def remove_staff(db: AsyncSession, staff_id: UUID, owner_id: UUID) -> bool:
    result = await db.execute(select(StaffMember).where(StaffMember.id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        return False
    
    staff.status = "removed"
    await db.commit()
    return True


async def log_activity(
    db: AsyncSession, staff_id: UUID, shop_id: UUID, action: str,
    entity_type: Optional[str] = None, entity_id: Optional[UUID] = None,
    description: Optional[str] = None, metadata: Optional[dict] = None,
) -> StaffActivityLog:
    log = StaffActivityLog(
        staff_id=staff_id, shop_id=shop_id, action=action, entity_type=entity_type,
        entity_id=entity_id, description=description, activity_metadata=metadata,
    )
    db.add(log)
    await db.commit()
    return log


async def get_activity_logs(
    db: AsyncSession, shop_id: UUID, staff_id: Optional[UUID] = None, limit: int = 50,
) -> List[StaffActivityLog]:
    query = select(StaffActivityLog).where(StaffActivityLog.shop_id == shop_id)
    if staff_id:
        query = query.where(StaffActivityLog.staff_id == staff_id)
    query = query.options(selectinload(StaffActivityLog.staff_member))
    query = query.order_by(desc(StaffActivityLog.created_at)).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


def check_permission(staff: StaffMember, permission: str) -> bool:
    role_data = STAFF_ROLES.get(staff.role, {})
    role_permissions = role_data.get("permissions", [])
    
    if "*" in role_permissions:
        return True
    if staff.permissions and permission in staff.permissions:
        return True
    if permission in role_permissions:
        return True
    return False
