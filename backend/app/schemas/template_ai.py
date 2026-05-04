from pydantic import BaseModel


class TemplateAISuggestedField(BaseModel):
    field_key: str
    label: str
    field_type: str = "text"
    excel_cell_ref: str | None = None
    display_order: int = 0
    is_required: bool = False
    options: dict | None = None
    source_hint: str | None = None


class TemplateAIExtractResponse(BaseModel):
    fields: list[TemplateAISuggestedField]
    notes: list[str] = []
