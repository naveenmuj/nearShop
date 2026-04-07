"""add_conversation_assignment

Revision ID: h1a2b3c4d5e7
Revises: c4d5e6f7a8b9
Create Date: 2026-04-07 19:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "h1a2b3c4d5e7"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	op.add_column(
		"conversations",
		sa.Column("assigned_to_user_id", postgresql.UUID(as_uuid=True), nullable=True),
	)
	op.add_column("conversations", sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True))
	op.create_foreign_key(
		"fk_conversations_assigned_to_user",
		"conversations",
		"users",
		["assigned_to_user_id"],
		["id"],
	)
	op.create_index(
		"ix_conversations_assigned_to_user_id",
		"conversations",
		["assigned_to_user_id"],
		unique=False,
	)


def downgrade() -> None:
	op.drop_index("ix_conversations_assigned_to_user_id", table_name="conversations")
	op.drop_constraint("fk_conversations_assigned_to_user", "conversations", type_="foreignkey")
	op.drop_column("conversations", "assigned_at")
	op.drop_column("conversations", "assigned_to_user_id")