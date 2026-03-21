from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    text,
    ARRAY,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Story(Base):
    __tablename__ = "stories"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True
    )
    media_url = Column(Text, nullable=False)
    media_type = Column(String(10), nullable=True)
    caption = Column(Text, nullable=True)
    product_tags = Column(ARRAY(UUID(as_uuid=True)), nullable=True)
    views = Column(Integer, server_default=text("0"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    shop = relationship("Shop", back_populates="stories")
