"""
Add instrument types table

Revision ID: f5f0d3c846d1
Revises: a9f3b61b1c1d
Create Date: 2026-05-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5f0d3c846d1"
down_revision: Union[str, None] = "a9f3b61b1c1d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "instrument_types",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("template_id", sa.Uuid(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_instrument_types_name"), "instrument_types", ["name"], unique=True)
    op.create_index(op.f("ix_instrument_types_template_id"), "instrument_types", ["template_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_instrument_types_template_id"), table_name="instrument_types")
    op.drop_index(op.f("ix_instrument_types_name"), table_name="instrument_types")
    op.drop_table("instrument_types")
