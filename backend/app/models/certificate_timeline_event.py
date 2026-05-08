import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimelineAuthorRole(str, enum.Enum):
    SYSTEM = "system"
    AGENTE = "agente"
    TECNICO = "tecnico"
    QUALIDADE = "qualidade"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class CertificateTimelineEvent(Base):
    __tablename__ = "certificate_timeline_events"
    __table_args__ = (
        Index(
            "idx_certificate_timeline_certificate_created",
            "certificate_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    certificate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("certificates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    author_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    author_role: Mapped[TimelineAuthorRole] = mapped_column(
        SAEnum(TimelineAuthorRole, name="timelineauthorrole", create_type=True),
        default=TimelineAuthorRole.SYSTEM,
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    certificate: Mapped["Certificate"] = relationship(back_populates="timeline_events")
    author_user: Mapped["User | None"] = relationship()

    def __repr__(self) -> str:
        return f"<CertificateTimelineEvent {self.event_type} ({self.certificate_id})>"
