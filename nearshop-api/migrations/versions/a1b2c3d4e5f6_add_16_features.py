"""add 16 features

Revision ID: a1b2c3d4e5f6
Revises: c9d8e7f6a5b4
Create Date: 2026-03-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'c9d8e7f6a5b4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # Feature 3: Recently Viewed
    # ------------------------------------------------------------------ #
    op.create_table(
        'user_recently_viewed',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('viewed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'product_id', name='uq_recently_viewed_user_product'),
    )
    op.execute(
        "CREATE INDEX idx_recently_viewed_user_time "
        "ON user_recently_viewed (user_id, viewed_at DESC)"
    )

    # ------------------------------------------------------------------ #
    # Feature 5: Search logs (add query column) & recent searches
    # Note: search_logs table already exists from initial migration.
    # We add a `query` VARCHAR(255) shorthand column alongside query_text.
    # ------------------------------------------------------------------ #
    op.execute(
        "ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS query VARCHAR(255)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_search_logs_time ON search_logs (created_at DESC)")

    op.create_table(
        'user_recent_searches',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('query', sa.String(255), nullable=False),
        sa.Column('searched_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'query', name='uq_recent_search_user_query'),
    )

    # ------------------------------------------------------------------ #
    # Feature 6: Order tracking events
    # ------------------------------------------------------------------ #
    op.create_table(
        'order_tracking_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('event_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.execute(
        "CREATE INDEX idx_tracking_order "
        "ON order_tracking_events (order_id, event_time)"
    )

    # ------------------------------------------------------------------ #
    # Feature 14: Achievements
    # ------------------------------------------------------------------ #
    op.create_table(
        'achievements',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('coins_reward', sa.Integer(), server_default='0', nullable=True),
        sa.Column('criteria_type', sa.String(50), nullable=True),
        sa.Column('criteria_value', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'user_achievements',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('achievement_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('unlocked_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['achievement_id'], ['achievements.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'achievement_id', name='uq_user_achievement'),
    )

    # ------------------------------------------------------------------ #
    # Feature 15: Daily spin
    # ------------------------------------------------------------------ #
    op.create_table(
        'daily_spins',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prize_label', sa.String(100), nullable=False),
        sa.Column('coins_won', sa.Integer(), server_default='0', nullable=False),
        sa.Column('spun_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.execute(
        "CREATE INDEX idx_daily_spins_user_date "
        "ON daily_spins (user_id, spun_at DESC)"
    )

    # ------------------------------------------------------------------ #
    # Alter users table — add spin + settings columns
    # ------------------------------------------------------------------ #
    op.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_spin_streak INTEGER DEFAULT 0')
    op.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_spin_date DATE')
    op.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN DEFAULT false')

    # ------------------------------------------------------------------ #
    # Feature 12: Deal expiry on products
    # ------------------------------------------------------------------ #
    op.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS deal_ends_at TIMESTAMP WITH TIME ZONE')

    # ------------------------------------------------------------------ #
    # Seed 7 achievements
    # ------------------------------------------------------------------ #
    op.execute("""
        INSERT INTO achievements (id, name, description, icon, coins_reward, criteria_type, criteria_value)
        VALUES
            (uuid_generate_v4(), 'First Purchase',      'Place your first order',                  '🛍️', 10,  'order_count',    1),
            (uuid_generate_v4(), '5 Orders',            'Place 5 orders',                          '⭐', 25,  'order_count',    5),
            (uuid_generate_v4(), '10 Orders',           'Place 10 orders',                         '🏆', 50,  'order_count',    10),
            (uuid_generate_v4(), 'First Referral',      'Refer your first friend',                 '🤝', 30,  'referral_count', 1),
            (uuid_generate_v4(), '100 Coins Earned',    'Earn 100 coins in total',                 '💰', 20,  'coins_earned',   100),
            (uuid_generate_v4(), 'Wishlist 10 Items',   'Add 10 items to your wishlist',           '❤️', 15,  'wishlist_count', 10),
            (uuid_generate_v4(), 'Daily Streak 7 Days', 'Spin the wheel 7 days in a row',         '🔥', 35,  'streak_days',    7)
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    # Remove seeded achievements (by name to avoid hardcoded UUIDs)
    op.execute("""
        DELETE FROM achievements
        WHERE name IN (
            'First Purchase', '5 Orders', '10 Orders', 'First Referral',
            '100 Coins Earned', 'Wishlist 10 Items', 'Daily Streak 7 Days'
        )
    """)

    op.execute('ALTER TABLE products DROP COLUMN IF EXISTS deal_ends_at')
    op.execute('ALTER TABLE users DROP COLUMN IF EXISTS sound_enabled')
    op.execute('ALTER TABLE users DROP COLUMN IF EXISTS last_spin_date')
    op.execute('ALTER TABLE users DROP COLUMN IF EXISTS daily_spin_streak')

    op.execute('DROP INDEX IF EXISTS idx_daily_spins_user_date')
    op.drop_table('daily_spins')

    op.drop_table('user_achievements')
    op.drop_table('achievements')

    op.execute('DROP INDEX IF EXISTS idx_tracking_order')
    op.drop_table('order_tracking_events')

    op.drop_table('user_recent_searches')
    op.execute('DROP INDEX IF EXISTS idx_search_logs_time')
    op.execute('ALTER TABLE search_logs DROP COLUMN IF EXISTS query')

    op.execute('DROP INDEX IF EXISTS idx_recently_viewed_user_time')
    op.drop_table('user_recently_viewed')
