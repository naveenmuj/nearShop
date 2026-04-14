"""Add catalog_templates table for product master catalog.

Revision ID: 0001_catalog_templates
Revises: 
Create Date: 2024-04-14 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001_catalog_templates'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create catalog_templates table
    op.create_table(
        'catalog_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), 
                  server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('sku', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('brand', sa.String(150), nullable=True),
        sa.Column('category', sa.String(100), nullable=False, index=True),
        sa.Column('subcategory', sa.String(100), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('short_description', sa.String(300), nullable=True),
        
        # Image URLs
        sa.Column('image_urls', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('thumbnail_url', sa.String(500), nullable=True),
        
        # Flexible attributes stored as JSONB
        sa.Column('attributes', postgresql.JSONB, nullable=True),
        sa.Column('variants', postgresql.JSONB, nullable=True),  # Color, Size, etc.
        
        # Sourcing metadata
        sa.Column('data_source', sa.String(50), nullable=True),  # 'flipkart', 'amazon', 'jiomart', 'user_submitted'
        sa.Column('source_url', sa.String(500), nullable=True),
        sa.Column('source_id', sa.String(100), nullable=True),  # External ID from source
        sa.Column('confidence_score', sa.Float, nullable=True),  # 0-1, how confident we are
        
        # Popularity tracking
        sa.Column('popularity_score', sa.Integer, server_default='0'),
        sa.Column('num_shops_using', sa.Integer, server_default='0'),
        sa.Column('avg_rating', sa.Float, nullable=True),
        sa.Column('num_reviews', sa.Integer, server_default='0'),
        
        # Pricing baseline
        sa.Column('base_price_inr', sa.Numeric(10, 2), nullable=True),
        sa.Column('compare_price_inr', sa.Numeric(10, 2), nullable=True),
        sa.Column('typical_discount_pct', sa.Float, nullable=True),
        
        # Status
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('is_verified', sa.Boolean, server_default='false'),
        sa.Column('last_scraped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), 
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), 
                  onupdate=sa.func.now(), nullable=True),
        
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for common queries
    op.create_index('idx_catalog_category_active', 'catalog_templates', 
                    ['category', 'is_active'])
    op.create_index('idx_catalog_brand', 'catalog_templates', ['brand'])
    op.create_index('idx_catalog_source', 'catalog_templates', ['data_source'])
    op.create_index('idx_catalog_popularity', 'catalog_templates', 
                    ['popularity_score'], postgresql_using='btree')
    
    # Create shop_catalog_selections table
    op.create_table(
        'shop_catalog_selections',
        sa.Column('id', postgresql.UUID(as_uuid=True), 
                  server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('shop_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('shops.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('catalog_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('catalog_templates.id', ondelete='CASCADE'), nullable=False, index=True),
        
        # Shop-specific pricing
        sa.Column('local_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('compare_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('local_description', sa.Text, nullable=True),
        
        # Shop-specific inventory
        sa.Column('stock_quantity', sa.Integer, nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        
        # Tracking
        sa.Column('selected_at', sa.DateTime(timezone=True), 
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shop_id', 'catalog_id', name='uq_shop_catalog')
    )
    
    op.create_index('idx_shop_catalog_active', 'shop_catalog_selections', 
                    ['shop_id', 'is_active'])


def downgrade() -> None:
    op.drop_index('idx_shop_catalog_active', table_name='shop_catalog_selections')
    op.drop_table('shop_catalog_selections')
    
    op.drop_index('idx_catalog_popularity', table_name='catalog_templates')
    op.drop_index('idx_catalog_source', table_name='catalog_templates')
    op.drop_index('idx_catalog_brand', table_name='catalog_templates')
    op.drop_index('idx_catalog_category_active', table_name='catalog_templates')
    op.drop_table('catalog_templates')
