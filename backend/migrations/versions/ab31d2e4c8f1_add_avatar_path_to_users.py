"""Add avatar path to users

Revision ID: ab31d2e4c8f1
Revises: 9d1ab2f4c6e9
Create Date: 2026-05-08 22:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "ab31d2e4c8f1"
down_revision = "9d1ab2f4c6e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_path")
