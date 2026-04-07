"""add_saved_search_intents

Revision ID: h2b3c4d5e6f8
Revises: h1a2b3c4d5e7
Create Date: 2026-04-07 20:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "h2b3c4d5e6f8"
down_revision: Union[str, None] = "h1a2b3c4d5e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	op.create_table(
		"user_saved_search_intents",
		sa.Column(
			"id",
			postgresql.UUID(as_uuid=True),
			server_default=sa.text("uuid_generate_v4()"),
			nullable=False,
		),
		sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
		sa.Column("query", sa.String(length=255), nullable=False),
		sa.Column("label", sa.String(length=100), nullable=True),
		sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
		sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
		sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
		sa.PrimaryKeyConstraint("id"),
		sa.UniqueConstraint("user_id", "query", name="uq_saved_intent_user_query"),
	)
	op.create_index(
		"ix_user_saved_search_intents_user_id",
		"user_saved_search_intents",
		["user_id"],
		unique=False,
	)


def downgrade() -> None:
	op.drop_index("ix_user_saved_search_intents_user_id", table_name="user_saved_search_intents")
	op.drop_table("user_saved_search_intents")