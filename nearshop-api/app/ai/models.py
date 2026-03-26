"""AI Usage tracking model — logs every OpenAI API call for cost analytics."""
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Text,
    DateTime,
    Boolean,
    ForeignKey,
    Index,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from app.core.database import Base


class AIUsageLog(Base):
    """Tracks every OpenAI API call: tokens, cost, latency, feature context."""
    __tablename__ = "ai_usage_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    # Who triggered it
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=True, index=True)

    # What was called
    feature = Column(String(50), nullable=False, index=True)  # e.g. 'smart_search', 'cataloging_snap', 'sentiment', 'advisor_chat', 'description_gen'
    endpoint = Column(String(100), nullable=True)              # API route path
    model = Column(String(50), nullable=False)                 # e.g. 'gpt-4o', 'gpt-4o-mini'

    # Token usage
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)

    # Cost in USD (calculated from model pricing)
    cost_usd = Column(Float, nullable=False, default=0.0)

    # Performance
    response_time_ms = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="success")  # 'success', 'error', 'timeout'
    error_message = Column(Text, nullable=True)

    # Request metadata
    request_metadata = Column(JSONB, nullable=True)  # prompt length, image size, etc.
    has_image = Column(Boolean, default=False)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True,
    )

    __table_args__ = (
        Index("ix_ai_usage_feature_created", "feature", "created_at"),
        Index("ix_ai_usage_model_created", "model", "created_at"),
    )
