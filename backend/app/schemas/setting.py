from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class SettingCreate(BaseModel):
    key: str
    label: str
    description: Optional[str] = None
    values: list[str] = []


class SettingUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    values: Optional[list[str]] = None


class SettingResponse(BaseModel):
    id: UUID
    key: str
    label: str
    description: Optional[str] = None
    values: list[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
