"""
Add ai setups table

Revision ID: b2d4fd7330d1
Revises: f5f0d3c846d1
Create Date: 2026-05-04 00:00:01.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2d4fd7330d1"
down_revision: Union[str, None] = "f5f0d3c846d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_setups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("openai_api_key", sa.String(length=500), nullable=True),
        sa.Column("openai_model", sa.String(length=100), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider"),
    )
    op.create_index(op.f("ix_ai_setups_provider"), "ai_setups", ["provider"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_setups_provider"), table_name="ai_setups")
    op.drop_table("ai_setups")
