from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Float,
    Text,
    DateTime,
    ForeignKey,
    ARRAY,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    post_type = Column(String(20), nullable=False)
    title = Column(String(300), nullable=False)
    body = Column(Text, nullable=True)
    images = Column(ARRAY(Text), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    upvotes = Column(Integer, server_default=text("0"), nullable=False)
    answers_count = Column(Integer, server_default=text("0"), nullable=False)
    is_resolved = Column(Boolean, server_default=text("false"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    answers = relationship(
        "CommunityAnswer", back_populates="post", order_by="CommunityAnswer.created_at"
    )


class CommunityAnswer(Base):
    __tablename__ = "community_answers"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_posts.id"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=True
    )
    body = Column(Text, nullable=False)
    is_ai_generated = Column(
        Boolean, server_default=text("false"), nullable=False
    )
    upvotes = Column(Integer, server_default=text("0"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    post = relationship("CommunityPost", back_populates="answers")
    user = relationship("User", foreign_keys=[user_id])
    shop = relationship("Shop", foreign_keys=[shop_id])
