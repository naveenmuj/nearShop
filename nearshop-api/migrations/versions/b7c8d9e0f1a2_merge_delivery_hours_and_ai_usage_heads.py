"""merge delivery hours and ai usage heads

Revision ID: b7c8d9e0f1a2
Revises: f2a3b4c5d6e7, g5h6i7j8k9l0
Create Date: 2026-03-28 13:15:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "b7c8d9e0f1a2"
down_revision: tuple[str, str] = ("f2a3b4c5d6e7", "g5h6i7j8k9l0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge-only migration to converge Alembic heads.
    pass


def downgrade() -> None:
    # Re-opening the split heads is sufficient for downgrade.
    pass
