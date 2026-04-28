"""
Add notifications table

Revision ID: a9f3b61b1c1d
Revises: 66f467a7d368
Create Date: 2026-04-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9f3b61b1c1d"
down_revision: Union[str, None] = "66f467a7d368"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("certificate_id", sa.Uuid(), nullable=True),
        sa.Column("queue_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(length=20), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["certificate_id"], ["certificates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["queue_id"], ["processing_queue.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index("idx_notifications_user_created", "notifications", ["user_id", "created_at"], unique=False)
    op.create_index("idx_notifications_user_read", "notifications", ["user_id", "is_read", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_notifications_user_read", table_name="notifications")
    op.drop_index("idx_notifications_user_created", table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")
