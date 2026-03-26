"""add ai_usage_logs table

Revision ID: f2a3b4c5d6e7
Revises: e7f1c2b4a9d8
Create Date: 2026-03-26 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f2a3b4c5d6e7"
down_revision: tuple = ("e7f1c2b4a9d8", "d1e2f3g4h5i6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.create_table(
        "ai_usage_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id"), nullable=True),
        sa.Column("feature", sa.String(50), nullable=False),
        sa.Column("endpoint", sa.String(100), nullable=True),
        sa.Column("model", sa.String(50), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("request_metadata", postgresql.JSONB(), nullable=True),
        sa.Column("has_image", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_usage_logs_user_id", "ai_usage_logs", ["user_id"])
    op.create_index("ix_ai_usage_logs_shop_id", "ai_usage_logs", ["shop_id"])
    op.create_index("ix_ai_usage_logs_feature", "ai_usage_logs", ["feature"])
    op.create_index("ix_ai_usage_logs_created_at", "ai_usage_logs", ["created_at"])
    op.create_index("ix_ai_usage_feature_created", "ai_usage_logs", ["feature", "created_at"])
    op.create_index("ix_ai_usage_model_created", "ai_usage_logs", ["model", "created_at"])


def downgrade() -> None:
    op.drop_table("ai_usage_logs")
