"""add_performance_indexes

Revision ID: 3e14156ebde3
Revises: ab8d88a83ceb
Create Date: 2026-03-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3e14156ebde3'
down_revision: Union[str, None] = 'ab8d88a83ceb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # FTS GIN index on products for full-text search
    op.execute(
        "CREATE INDEX idx_products_fts ON products USING GIN "
        "(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')))"
    )

    # Composite index on products for shop + category filtered by availability
    op.execute(
        "CREATE INDEX idx_products_shop_category ON products (shop_id, category) "
        "WHERE is_available = true"
    )

    # Price index on products filtered by availability
    op.execute(
        "CREATE INDEX idx_products_price ON products (price) "
        "WHERE is_available = true"
    )

    # Deals expiry index filtered by active deals
    op.execute(
        "CREATE INDEX idx_deals_expires ON deals (expires_at) "
        "WHERE is_active = true"
    )

    # JSONB GIN index on products attributes
    op.execute(
        "CREATE INDEX idx_products_attributes ON products USING GIN (attributes)"
    )

    # Orders composite index for customer lookups sorted by date
    op.execute(
        "CREATE INDEX idx_orders_customer ON orders (customer_id, created_at DESC)"
    )

    # Orders shop + status composite index
    op.execute(
        "CREATE INDEX idx_orders_shop_status ON orders (shop_id, status)"
    )

    # User events index for user activity lookups sorted by date
    op.execute(
        "CREATE INDEX idx_user_events_user ON user_events (user_id, created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_user_events_user")
    op.execute("DROP INDEX IF EXISTS idx_orders_shop_status")
    op.execute("DROP INDEX IF EXISTS idx_orders_customer")
    op.execute("DROP INDEX IF EXISTS idx_products_attributes")
    op.execute("DROP INDEX IF EXISTS idx_deals_expires")
    op.execute("DROP INDEX IF EXISTS idx_products_price")
    op.execute("DROP INDEX IF EXISTS idx_products_shop_category")
    op.execute("DROP INDEX IF EXISTS idx_products_fts")
