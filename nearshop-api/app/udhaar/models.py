from sqlalchemy import (
    Column,
    Boolean,
    Numeric,
    Text,
    String,
    DateTime,
    ForeignKey,
    text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UdhaarAccount(Base):
    __tablename__ = "udhaar_accounts"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    shop_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    credit_limit = Column(
        Numeric(10, 2), default=2000, server_default="2000", nullable=False
    )
    current_balance = Column(
        Numeric(10, 2), default=0, server_default="0", nullable=False
    )
    is_active = Column(Boolean, default=True, server_default="true", nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("shop_id", "customer_id", name="uq_udhaar_shop_customer"),
    )

    # Relationships
    shop = relationship("Shop", foreign_keys=[shop_id])
    customer = relationship("User", foreign_keys=[customer_id])
    transactions = relationship("UdhaarTransaction", back_populates="account", lazy="noload")


class UdhaarTransaction(Base):
    __tablename__ = "udhaar_transactions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("udhaar_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount = Column(Numeric(10, 2), nullable=False)
    transaction_type = Column(String(10), nullable=False)  # 'credit' or 'payment'
    description = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    account = relationship("UdhaarAccount", back_populates="transactions")
