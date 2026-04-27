from pydantic import BaseModel
from typing import Optional, Any
from uuid import UUID
from datetime import datetime
from app.models.template import FieldType


# --- TemplateField schemas ---

class TemplateFieldCreate(BaseModel):
    field_key: str
    label: str
    field_type: FieldType = FieldType.TEXT
    options: Optional[dict] = None
    excel_cell_ref: Optional[str] = None
    display_order: int = 0
    is_required: bool = False


class TemplateFieldUpdate(BaseModel):
    field_key: Optional[str] = None
    label: Optional[str] = None
    field_type: Optional[FieldType] = None
    options: Optional[dict] = None
    excel_cell_ref: Optional[str] = None
    display_order: Optional[int] = None
    is_required: Optional[bool] = None


class TemplateFieldResponse(BaseModel):
    id: UUID
    template_id: UUID
    field_key: str
    label: str
    field_type: FieldType
    options: Optional[dict] = None
    excel_cell_ref: Optional[str] = None
    display_order: int
    is_required: bool

    model_config = {"from_attributes": True}


# --- Template schemas ---

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    excel_template_path: Optional[str] = None
    default_config: Optional[dict] = None
    fields: Optional[list[TemplateFieldCreate]] = []


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    excel_template_path: Optional[str] = None
    default_config: Optional[dict] = None
    is_active: Optional[bool] = None


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    excel_template_path: Optional[str] = None
    default_config: Optional[dict] = None
    is_active: bool
    fields: list[TemplateFieldResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateListResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_active: bool
    field_count: Optional[int] = 0
    created_at: datetime

    model_config = {"from_attributes": True}
