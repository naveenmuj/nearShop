from sqlalchemy import Column, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import text, func
from app.core.database import Base


class Bill(Base):
    __tablename__ = "bills"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    bill_number = Column(String(30), unique=True, nullable=False)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_name = Column(String(200))
    customer_phone = Column(String(15))
    items = Column(JSONB, nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)
    gst_amount = Column(Numeric(10, 2), server_default=text("0"), nullable=False)
    gst_percentage = Column(Numeric(4, 2), server_default=text("0"), nullable=False)
    discount_amount = Column(Numeric(10, 2), server_default=text("0"), nullable=False)
    delivery_fee = Column(Numeric(10, 2), server_default=text("0"), nullable=False)
    total = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(20))
    payment_status = Column(String(20), server_default=text("'paid'"), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
