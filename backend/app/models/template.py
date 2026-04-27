import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class FieldType(str, enum.Enum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    SELECT = "select"
    TEXTAREA = "textarea"


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[uuid.UUID] = mapped_column(
        default=uuid.uuid4, primary_key=True
    )
    name: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    excel_template_path: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    default_config: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
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
    fields: Mapped[list["TemplateField"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="TemplateField.display_order",
    )
    certificates: Mapped[list["Certificate"]] = relationship(
        back_populates="template"
    )

    def __repr__(self) -> str:
        return f"<Template {self.name}>"


class TemplateField(Base):
    __tablename__ = "template_fields"

    id: Mapped[uuid.UUID] = mapped_column(
        default=uuid.uuid4, primary_key=True
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_key: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[FieldType] = mapped_column(
        SAEnum(FieldType, name="field_type", create_type=True),
        default=FieldType.TEXT,
        nullable=False,
    )
    options: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, default=None
    )
    excel_cell_ref: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    display_order: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    template: Mapped["Template"] = relationship(back_populates="fields")

    def __repr__(self) -> str:
        return f"<TemplateField {self.field_key} -> {self.excel_cell_ref}>"
