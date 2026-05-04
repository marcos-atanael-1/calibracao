from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class InstrumentTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_id: Optional[UUID] = None
    is_active: bool = True


class InstrumentTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    template_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class InstrumentTypeResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    template_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
