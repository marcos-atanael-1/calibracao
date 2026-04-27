import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Integer, DateTime, ForeignKey, Text, Enum as SAEnum, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class QueueStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class ProcessingQueue(Base):
    __tablename__ = "processing_queue"
    __table_args__ = (
        Index("idx_queue_status_created", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        default=uuid.uuid4, primary_key=True
    )
    certificate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("certificates.id"),
        unique=True,
        nullable=False,
    )
    status: Mapped[QueueStatus] = mapped_column(
        SAEnum(QueueStatus, name="queue_status", create_type=True),
        default=QueueStatus.PENDING,
        nullable=False,
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    worker_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    certificate: Mapped["Certificate"] = relationship(
        back_populates="queue_item"
    )

    def __repr__(self) -> str:
        return f"<QueueItem {self.certificate_id} ({self.status.value})>"
