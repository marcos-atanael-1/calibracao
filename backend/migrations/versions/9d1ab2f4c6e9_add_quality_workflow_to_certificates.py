"""
Add quality workflow to certificates

Revision ID: 9d1ab2f4c6e9
Revises: 3f17b4c2a8e1
Create Date: 2026-05-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "9d1ab2f4c6e9"
down_revision: Union[str, None] = "3f17b4c2a8e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    quality_status_enum = postgresql.ENUM(
        "PENDING_REVIEW",
        "IN_REVIEW",
        "WAITING_TECHNICIAN",
        "READY_FOR_REPROCESS",
        "REPROCESSING",
        "AWAITING_FINAL_VALIDATION",
        "APPROVED",
        "REJECTED",
        name="certificate_quality_status",
    )

    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'QUALIDADE'")
    quality_status_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "certificate_timeline_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("certificate_id", sa.Uuid(), nullable=False),
        sa.Column("author_user_id", sa.Uuid(), nullable=True),
        sa.Column("author_name", sa.String(length=255), nullable=True),
        sa.Column(
            "author_role",
            sa.Enum(
                "SYSTEM",
                "AGENTE",
                "TECNICO",
                "QUALIDADE",
                "ADMIN",
                "SUPER_ADMIN",
                name="timelineauthorrole",
            ),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["certificate_id"], ["certificates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_certificate_timeline_certificate_created",
        "certificate_timeline_events",
        ["certificate_id", "created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_certificate_timeline_events_certificate_id"),
        "certificate_timeline_events",
        ["certificate_id"],
        unique=False,
    )

    op.add_column(
        "certificates",
        sa.Column(
            "quality_status",
            quality_status_enum,
            nullable=True,
        ),
    )
    op.add_column("certificates", sa.Column("quality_assigned_to", sa.Uuid(), nullable=True))
    op.add_column("certificates", sa.Column("submitted_to_quality_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("certificates", sa.Column("quality_approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("certificates", sa.Column("quality_rejected_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("certificates", sa.Column("requires_reprocess", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("certificates", sa.Column("review_pdf_path", sa.String(length=500), nullable=True))
    op.add_column("certificates", sa.Column("official_pdf_path", sa.String(length=500), nullable=True))
    op.add_column("certificates", sa.Column("source_pdf_path", sa.String(length=500), nullable=True))
    op.create_index("idx_certificates_quality_status", "certificates", ["quality_status"], unique=False)
    op.create_index(op.f("ix_certificates_quality_assigned_to"), "certificates", ["quality_assigned_to"], unique=False)
    op.create_foreign_key(
        "fk_certificates_quality_assigned_to_users",
        "certificates",
        "users",
        ["quality_assigned_to"],
        ["id"],
    )

    op.execute(
        """
        UPDATE certificates
        SET
            quality_status = CASE
                WHEN status = 'DONE' THEN 'APPROVED'::certificate_quality_status
                ELSE 'PENDING_REVIEW'::certificate_quality_status
            END,
            submitted_to_quality_at = CASE
                WHEN status IN ('QUEUED', 'PROCESSING', 'DONE', 'ERROR') THEN COALESCE(created_at, NOW())
                ELSE NULL
            END,
            official_pdf_path = CASE
                WHEN status = 'DONE' THEN pdf_path
                ELSE NULL
            END,
            review_pdf_path = CASE
                WHEN status = 'DONE' THEN pdf_path
                ELSE NULL
            END,
            source_pdf_path = CASE
                WHEN status = 'DONE' THEN pdf_path
                ELSE NULL
            END
        """
    )
    op.alter_column("certificates", "quality_status", nullable=False)
    op.alter_column("certificates", "requires_reprocess", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_certificates_quality_assigned_to_users", "certificates", type_="foreignkey")
    op.drop_index(op.f("ix_certificates_quality_assigned_to"), table_name="certificates")
    op.drop_index("idx_certificates_quality_status", table_name="certificates")
    op.drop_column("certificates", "source_pdf_path")
    op.drop_column("certificates", "official_pdf_path")
    op.drop_column("certificates", "review_pdf_path")
    op.drop_column("certificates", "requires_reprocess")
    op.drop_column("certificates", "quality_rejected_at")
    op.drop_column("certificates", "quality_approved_at")
    op.drop_column("certificates", "submitted_to_quality_at")
    op.drop_column("certificates", "quality_assigned_to")
    op.drop_column("certificates", "quality_status")
    op.drop_index(op.f("ix_certificate_timeline_events_certificate_id"), table_name="certificate_timeline_events")
    op.drop_index("idx_certificate_timeline_certificate_created", table_name="certificate_timeline_events")
    op.drop_table("certificate_timeline_events")
    op.execute("DROP TYPE IF EXISTS certificate_quality_status")
    op.execute("DROP TYPE IF EXISTS timelineauthorrole")
