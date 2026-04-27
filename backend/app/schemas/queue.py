from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.processing_queue import QueueStatus


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

    model_config = {"from_attributes": True}


class QueueUpdateRequest(BaseModel):
    status: QueueStatus
    error_message: Optional[str] = None
    worker_id: Optional[str] = None
    pdf_path: Optional[str] = None
