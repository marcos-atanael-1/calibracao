from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.certificate import CertificateQualityStatus, CertificateStatus
from app.models.certificate_timeline_event import TimelineAuthorRole
from app.schemas.certificate import CertificateResponse
from app.schemas.user import UserResponse


class QualityCommentRequest(BaseModel):
    message: str


class QualityReturnRequest(BaseModel):
    message: str


class QualityReprocessRequest(BaseModel):
    message: Optional[str] = None


class QualityRejectRequest(BaseModel):
    message: str


class QualityMoveRequest(BaseModel):
    target_status: CertificateQualityStatus
    message: Optional[str] = None


class QualityTimelineEventResponse(BaseModel):
    id: UUID
    certificate_id: UUID
    author_user_id: Optional[UUID] = None
    author_name: Optional[str] = None
    author_role: TimelineAuthorRole
    event_type: str
    message: Optional[str] = None
    metadata_json: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QualityBoardItemResponse(BaseModel):
    id: UUID
    certificate_number: str
    service_order_number: Optional[str] = None
    instrument_description: Optional[str] = None
    extra_fields: Optional[dict] = None
    status: CertificateStatus
    quality_status: CertificateQualityStatus
    review_pdf_path: Optional[str] = None
    official_pdf_path: Optional[str] = None
    requires_reprocess: bool = False
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    quality_assigned_to: Optional[UUID] = None
    quality_assigned_user: Optional[UserResponse] = None
    created_by_user: Optional[UserResponse] = None

    model_config = {"from_attributes": True}


class QualityCertificateDetailResponse(BaseModel):
    certificate: CertificateResponse
    timeline: list[QualityTimelineEventResponse]
