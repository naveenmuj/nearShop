from sqlalchemy import Column, String, Text, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import text, func
from app.core.database import Base


class StockLog(Base):
    __tablename__ = "stock_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    change_type = Column(String(20), nullable=False)  # restock, sold, adjustment, return
    quantity_change = Column(Integer, nullable=False)
    quantity_after = Column(Integer)
    purchase_price = Column(Numeric(10, 2), nullable=True)
    supplier_name = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
