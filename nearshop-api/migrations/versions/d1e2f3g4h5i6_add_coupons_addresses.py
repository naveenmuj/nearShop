"""add coupons and addresses tables

Revision ID: d1e2f3g4h5i6
Revises: f1a2b3c4d5e6
Create Date: 2026-03-25 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd1e2f3g4h5i6'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add FCM fields to users table
    op.add_column('users', sa.Column('fcm_token', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('fcm_device_type', sa.String(20), nullable=True))
    
    # Create coupons table
    op.create_table(
        'coupons',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('shop_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('discount_type', sa.String(20), nullable=False),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False),
        sa.Column('max_discount', sa.Numeric(10, 2), nullable=True),
        sa.Column('min_order_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('max_uses_per_user', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('current_uses', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('applicable_categories', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('first_order_only', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_coupons_code', 'coupons', ['code'], unique=True)
    op.create_index('ix_coupons_shop_id', 'coupons', ['shop_id'])

    # Create coupon_usages table
    op.create_table(
        'coupon_usages',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('coupon_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('discount_applied', sa.Numeric(10, 2), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['coupon_id'], ['coupons.id'], ),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_coupon_usages_coupon_id', 'coupon_usages', ['coupon_id'])
    op.create_index('ix_coupon_usages_user_id', 'coupon_usages', ['user_id'])

    # Create user_addresses table
    op.create_table(
        'user_addresses',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('label', sa.String(50), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(15), nullable=True),
        sa.Column('address_line1', sa.String(255), nullable=False),
        sa.Column('address_line2', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('pincode', sa.String(10), nullable=False),
        sa.Column('landmark', sa.String(200), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_addresses_user_id', 'user_addresses', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_user_addresses_user_id', table_name='user_addresses')
    op.drop_table('user_addresses')
    op.drop_index('ix_coupon_usages_user_id', table_name='coupon_usages')
    op.drop_index('ix_coupon_usages_coupon_id', table_name='coupon_usages')
    op.drop_table('coupon_usages')
    op.drop_index('ix_coupons_shop_id', table_name='coupons')
    op.drop_index('ix_coupons_code', table_name='coupons')
    op.drop_table('coupons')
    op.drop_column('users', 'fcm_device_type')
    op.drop_column('users', 'fcm_token')
