"""add delivery hours to shops

Revision ID: g5h6i7j8k9l0
Revises: d1e2f3g4h5i6
Create Date: 2026-03-27 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'g5h6i7j8k9l0'
down_revision: Union[str, None] = 'd1e2f3g4h5i6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add delivery hours columns to shops table
    op.add_column('shops', sa.Column('delivery_available', sa.String(20), server_default=sa.text("'all_day'"), nullable=False))
    op.add_column('shops', sa.Column('delivery_hours', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    # Remove delivery hours columns from shops table
    op.drop_column('shops', 'delivery_hours')
    op.drop_column('shops', 'delivery_available')
