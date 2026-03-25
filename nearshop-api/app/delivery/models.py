from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DeliveryZone(Base):
    """Precision delivery zone for a shop (radius or polygon based)."""
    __tablename__ = "delivery_zones"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True
    )
    zone_type = Column(String(20), default="radius", nullable=False)  # "radius" or "polygon"
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    radius_km = Column(Float, nullable=True)  # For radius-based zones
    polygon_coords = Column(JSONB, nullable=True)  # For polygon-based zones
    fee = Column(Float, nullable=False, default=0)
    free_above = Column(Float, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    shop = relationship("Shop", back_populates="delivery_zones")
