from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Numeric,
    Text,
    DateTime,
    ForeignKey,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Deal(Base):
    __tablename__ = "deals"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True
    )
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=True
    )
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    discount_pct = Column(Integer, nullable=True)
    discount_amount = Column(Numeric(10, 2), nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, server_default=text("true"), nullable=False)
    max_claims = Column(Integer, nullable=True)
    current_claims = Column(Integer, server_default=text("0"), nullable=False)
    views = Column(Integer, server_default=text("0"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    shop = relationship("Shop", back_populates="deals")
    product = relationship("Product")
