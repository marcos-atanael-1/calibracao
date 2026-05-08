import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    String, DateTime, Integer, Numeric, ForeignKey, Text, Enum as SAEnum, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class CertificateStatus(str, enum.Enum):
    DRAFT = "draft"
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class CertificateQualityStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    IN_REVIEW = "in_review"
    WAITING_TECHNICIAN = "waiting_technician"
    READY_FOR_REPROCESS = "ready_for_reprocess"
    REPROCESSING = "reprocessing"
    AWAITING_FINAL_VALIDATION = "awaiting_final_validation"
    APPROVED = "approved"
    REJECTED = "rejected"


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (
        Index("idx_certificates_status", "status"),
        Index("idx_certificates_template", "template_id"),
        Index("idx_certificates_created_by", "created_by"),
        Index("idx_certificates_quality_status", "quality_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        default=uuid.uuid4, primary_key=True
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("templates.id"), nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    certificate_number: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    service_order_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    instrument_tag: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    instrument_description: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    manufacturer: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    model: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    serial_number: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    range_min: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    range_max: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    unit: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    extra_fields: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    status: Mapped[CertificateStatus] = mapped_column(
        SAEnum(CertificateStatus, name="certificate_status", create_type=True),
        default=CertificateStatus.DRAFT,
        nullable=False,
    )
    quality_status: Mapped[CertificateQualityStatus] = mapped_column(
        SAEnum(
            CertificateQualityStatus,
            name="certificate_quality_status",
            create_type=True,
        ),
        default=CertificateQualityStatus.PENDING_REVIEW,
        nullable=False,
    )
    quality_assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    submitted_to_quality_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    quality_approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    quality_rejected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    requires_reprocess: Mapped[bool] = mapped_column(default=False, nullable=False)
    review_pdf_path: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    official_pdf_path: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    source_pdf_path: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    pdf_path: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    calibration_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    template: Mapped["Template"] = relationship(back_populates="certificates")
    created_by_user: Mapped["User"] = relationship(
        back_populates="certificates",
        foreign_keys=[created_by],
    )
    quality_assigned_user: Mapped["User | None"] = relationship(
        back_populates="quality_certificates",
        foreign_keys=[quality_assigned_to],
    )
    points: Mapped[list["CertificatePoint"]] = relationship(
        back_populates="certificate",
        cascade="all, delete-orphan",
        order_by="CertificatePoint.point_number",
    )
    queue_item: Mapped["ProcessingQueue"] = relationship(
        back_populates="certificate",
        uselist=False,
    )
    timeline_events: Mapped[list["CertificateTimelineEvent"]] = relationship(
        back_populates="certificate",
        cascade="all, delete-orphan",
        order_by="CertificateTimelineEvent.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Certificate {self.certificate_number} ({self.status.value})>"


class CertificatePoint(Base):
    __tablename__ = "certificate_points"

    id: Mapped[uuid.UUID] = mapped_column(
        default=uuid.uuid4, primary_key=True
    )
    certificate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("certificates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    point_number: Mapped[int] = mapped_column(Integer, nullable=False)
    nominal_value: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 6), nullable=True
    )
    measured_value: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 6), nullable=True
    )
    error_value: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 6), nullable=True
    )
    uncertainty: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 6), nullable=True
    )
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    excel_row_ref: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )

    # Relationships
    certificate: Mapped["Certificate"] = relationship(back_populates="points")

    def __repr__(self) -> str:
        return f"<CertificatePoint #{self.point_number}>"
