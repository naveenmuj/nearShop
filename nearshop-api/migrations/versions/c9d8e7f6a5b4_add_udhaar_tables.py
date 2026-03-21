"""add udhaar tables

Revision ID: c9d8e7f6a5b4
Revises: f1a2b3c4d5e6
Create Date: 2026-03-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'c9d8e7f6a5b4'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'udhaar_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('shop_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('credit_limit', sa.Numeric(10, 2), server_default='2000', nullable=False),
        sa.Column('current_balance', sa.Numeric(10, 2), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shop_id', 'customer_id', name='uq_udhaar_shop_customer'),
    )
    op.create_index(op.f('ix_udhaar_accounts_shop_id'), 'udhaar_accounts', ['shop_id'], unique=False)
    op.create_index(op.f('ix_udhaar_accounts_customer_id'), 'udhaar_accounts', ['customer_id'], unique=False)

    op.create_table(
        'udhaar_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('transaction_type', sa.String(10), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['udhaar_accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_udhaar_transactions_account_id'), 'udhaar_transactions', ['account_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_udhaar_transactions_account_id'), table_name='udhaar_transactions')
    op.drop_table('udhaar_transactions')
    op.drop_index(op.f('ix_udhaar_accounts_customer_id'), table_name='udhaar_accounts')
    op.drop_index(op.f('ix_udhaar_accounts_shop_id'), table_name='udhaar_accounts')
    op.drop_table('udhaar_accounts')
