"""add_firebase_uid_email_avatar

Revision ID: 6cbb843335f5
Revises: c9d8e7f6a5b4
Create Date: 2026-03-16 16:24:27.811774

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6cbb843335f5'
down_revision: Union[str, None] = 'c9d8e7f6a5b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add firebase_uid column
    op.add_column('users', sa.Column('firebase_uid', sa.String(length=128), nullable=True))
    # Make phone nullable (Google/Apple users may not have a phone)
    op.alter_column('users', 'phone',
               existing_type=sa.VARCHAR(length=15),
               nullable=True)
    # Index on firebase_uid for fast lookups
    op.create_index('ix_users_firebase_uid', 'users', ['firebase_uid'], unique=True)
    # Unique constraint on email (was not unique before)
    op.create_unique_constraint('uq_users_email', 'users', ['email'])


def downgrade() -> None:
    op.drop_constraint('uq_users_email', 'users', type_='unique')
    op.drop_index('ix_users_firebase_uid', table_name='users')
    op.alter_column('users', 'phone',
               existing_type=sa.VARCHAR(length=15),
               nullable=False)
    op.drop_column('users', 'firebase_uid')
