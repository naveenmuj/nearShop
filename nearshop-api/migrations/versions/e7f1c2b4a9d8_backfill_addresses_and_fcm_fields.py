"""backfill addresses and fcm fields on live head

Revision ID: e7f1c2b4a9d8
Revises: 0c01bcc6f5a6
Create Date: 2026-03-26 11:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e7f1c2b4a9d8"
down_revision: Union[str, None] = "0c01bcc6f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT")
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_device_type VARCHAR(20)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_addresses (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id),
            label VARCHAR(50) NOT NULL,
            full_name VARCHAR(100),
            phone VARCHAR(15),
            address_line1 VARCHAR(255) NOT NULL,
            address_line2 VARCHAR(255),
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100),
            pincode VARCHAR(10) NOT NULL,
            landmark VARCHAR(200),
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            is_default BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_addresses_user_id ON user_addresses (user_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_user_addresses_user_id")
    op.execute("DROP TABLE IF EXISTS user_addresses")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS fcm_device_type")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS fcm_token")
