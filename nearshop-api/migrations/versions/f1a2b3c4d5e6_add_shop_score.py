"""add shop score

Revision ID: f1a2b3c4d5e6
Revises: a9b8c7d6e5f4
Create Date: 2026-03-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'a9b8c7d6e5f4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('shops', sa.Column('score', sa.Numeric(8, 4), nullable=False, server_default='0.0'))


def downgrade() -> None:
    op.drop_column('shops', 'score')
