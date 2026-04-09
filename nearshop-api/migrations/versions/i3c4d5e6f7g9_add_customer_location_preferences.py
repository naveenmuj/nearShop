"""add customer location preference fields

Revision ID: i3c4d5e6f7g9
Revises: h2b3c4d5e6f8
Create Date: 2026-04-09 10:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "i3c4d5e6f7g9"
down_revision: Union[str, None] = "h2b3c4d5e6f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("location_address", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "preferred_shop_radius_km",
            sa.Float(),
            nullable=False,
            server_default=sa.text("5.0"),
        ),
    )
    op.add_column("users", sa.Column("location_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "location_updated_at")
    op.drop_column("users", "preferred_shop_radius_km")
    op.drop_column("users", "location_address")
