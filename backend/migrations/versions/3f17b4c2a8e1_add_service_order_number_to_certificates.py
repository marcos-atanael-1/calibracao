"""
Add service order number to certificates

Revision ID: 3f17b4c2a8e1
Revises: b2d4fd7330d1
Create Date: 2026-05-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3f17b4c2a8e1"
down_revision: Union[str, None] = "b2d4fd7330d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "certificates",
        sa.Column("service_order_number", sa.String(length=100), nullable=True),
    )
    op.create_index(
        "ix_certificates_service_order_number",
        "certificates",
        ["service_order_number"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_certificates_service_order_number", table_name="certificates")
    op.drop_column("certificates", "service_order_number")
