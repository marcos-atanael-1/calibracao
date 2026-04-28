from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.processing_queue import QueueStatus


class QueueCertificateSummary(BaseModel):
    id: UUID
    certificate_number: str
    instrument_description: Optional[str] = None
    extra_fields: Optional[dict] = None
    pdf_path: Optional[str] = None

    model_config = {"from_attributes": True}


class QueueItemResponse(BaseModel):
    id: UUID
    certificate_id: UUID
    status: QueueStatus
    retry_count: int
    max_retries: int
    error_message: Optional[str] = None
    worker_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    certificate: Optional[QueueCertificateSummary] = None

    model_config = {"from_attributes": True}


class QueueUpdateRequest(BaseModel):
    status: QueueStatus
    error_message: Optional[str] = None
    worker_id: Optional[str] = None
    pdf_path: Optional[str] = None
