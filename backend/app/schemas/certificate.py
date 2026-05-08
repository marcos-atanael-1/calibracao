from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from app.models.certificate import CertificateQualityStatus, CertificateStatus
from app.schemas.user import UserResponse


# --- CertificatePoint schemas ---

class CertificatePointCreate(BaseModel):
    point_number: int
    nominal_value: Optional[Decimal] = None
    measured_value: Optional[Decimal] = None
    error_value: Optional[Decimal] = None
    uncertainty: Optional[Decimal] = None
    unit: Optional[str] = None
    excel_row_ref: Optional[str] = None


class CertificatePointResponse(BaseModel):
    id: UUID
    point_number: int
    nominal_value: Optional[Decimal] = None
    measured_value: Optional[Decimal] = None
    error_value: Optional[Decimal] = None
    uncertainty: Optional[Decimal] = None
    unit: Optional[str] = None
    excel_row_ref: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Certificate schemas ---

class CertificateCreate(BaseModel):
    template_id: Optional[UUID] = None
    certificate_number: str
    service_order_number: Optional[str] = None
    instrument_tag: Optional[str] = None
    instrument_description: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    range_min: Optional[str] = None
    range_max: Optional[str] = None
    unit: Optional[str] = None
    extra_fields: Optional[dict] = {}
    calibration_date: Optional[datetime] = None
    points: Optional[list[CertificatePointCreate]] = []
    enqueue_for_processing: bool = True


class CertificateUpdate(BaseModel):
    template_id: Optional[UUID] = None
    certificate_number: Optional[str] = None
    service_order_number: Optional[str] = None
    instrument_tag: Optional[str] = None
    instrument_description: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    range_min: Optional[str] = None
    range_max: Optional[str] = None
    unit: Optional[str] = None
    extra_fields: Optional[dict] = None
    calibration_date: Optional[datetime] = None
    points: Optional[list[CertificatePointCreate]] = None
    enqueue_for_processing: bool = False


class CertificateResponse(BaseModel):
    id: UUID
    template_id: UUID
    created_by: UUID
    certificate_number: str
    service_order_number: Optional[str] = None
    instrument_tag: Optional[str] = None
    instrument_description: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    range_min: Optional[str] = None
    range_max: Optional[str] = None
    unit: Optional[str] = None
    extra_fields: Optional[dict] = None
    status: CertificateStatus
    quality_status: CertificateQualityStatus
    quality_assigned_to: Optional[UUID] = None
    created_by_user: Optional[UserResponse] = None
    quality_assigned_user: Optional[UserResponse] = None
    submitted_to_quality_at: Optional[datetime] = None
    quality_approved_at: Optional[datetime] = None
    quality_rejected_at: Optional[datetime] = None
    requires_reprocess: bool = False
    review_pdf_path: Optional[str] = None
    official_pdf_path: Optional[str] = None
    source_pdf_path: Optional[str] = None
    pdf_path: Optional[str] = None
    ai_summary: Optional[str] = None
    calibration_date: Optional[datetime] = None
    points: list[CertificatePointResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CertificateListResponse(BaseModel):
    id: UUID
    certificate_number: str
    service_order_number: Optional[str] = None
    instrument_tag: Optional[str] = None
    instrument_description: Optional[str] = None
    extra_fields: Optional[dict] = None
    pdf_path: Optional[str] = None
    status: CertificateStatus
    quality_status: CertificateQualityStatus
    requires_reprocess: bool = False
    review_pdf_path: Optional[str] = None
    official_pdf_path: Optional[str] = None
    calibration_date: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
