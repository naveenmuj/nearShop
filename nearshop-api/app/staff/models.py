"""Staff Management Models"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


STAFF_ROLES = {
    "admin": {"label": "Admin", "permissions": ["*"]},
    "manager": {"label": "Manager", "permissions": ["orders", "products", "inventory", "customers", "analytics"]},
    "staff": {"label": "Staff", "permissions": ["orders", "products"]},
    "delivery": {"label": "Delivery", "permissions": ["orders"]},
}


class StaffMember(Base):
    """Staff members for a shop."""
    __tablename__ = "staff_members"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    
    # Invitation details
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    name = Column(String(100), nullable=False)
    
    # Role and permissions
    role = Column(String(20), nullable=False, default="staff")  # admin, manager, staff, delivery
    permissions = Column(JSONB, nullable=True)  # Custom permissions override
    
    # Status: invited, active, suspended, removed
    status = Column(String(20), server_default=text("'invited'"), nullable=False)
    invite_code = Column(String(50), nullable=True, unique=True)
    invite_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    joined_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    shop = relationship("Shop", foreign_keys=[shop_id])
    user = relationship("User", foreign_keys=[user_id])
    activity_logs = relationship("StaffActivityLog", back_populates="staff_member")


class StaffActivityLog(Base):
    """Activity logs for staff actions."""
    __tablename__ = "staff_activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    staff_id = Column(UUID(as_uuid=True), ForeignKey("staff_members.id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True)
    
    action = Column(String(50), nullable=False)  # order_updated, product_added, inventory_changed, etc.
    entity_type = Column(String(30), nullable=True)  # order, product, customer
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(Text, nullable=True)
    activity_metadata = Column("metadata", JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    staff_member = relationship("StaffMember", back_populates="activity_logs")
    shop = relationship("Shop", foreign_keys=[shop_id])
