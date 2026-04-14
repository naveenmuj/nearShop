"""merge catalog and main migration heads

Revision ID: j4d5e6f7g8h0
Revises: i3c4d5e6f7g9, 0001_catalog_templates
Create Date: 2026-04-14 16:20:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "j4d5e6f7g8h0"
down_revision: tuple[str, str] = ("i3c4d5e6f7g9", "0001_catalog_templates")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge-only migration to converge Alembic heads.
    pass


def downgrade() -> None:
    # Re-open split heads on downgrade.
    pass
