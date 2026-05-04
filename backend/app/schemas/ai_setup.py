from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class AISetupUpdate(BaseModel):
    openai_api_key: str | None = None
    openai_model: str
    is_enabled: bool = False


class AISetupResponse(BaseModel):
    id: UUID
    provider: str
    openai_model: str
    is_enabled: bool
    has_api_key: bool
    masked_api_key: str | None = None
    updated_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
