from pydantic import BaseModel
from typing import Optional, Any


class APIResponse(BaseModel):
    """Standard API response wrapper."""
    data: Any = None
    message: str = "Success"
    meta: Optional[dict] = None


class APIError(BaseModel):
    """Standard API error response."""
    code: str
    message: str
    details: Optional[list[dict]] = None


class PaginationMeta(BaseModel):
    page: int
    per_page: int
    total: int
    total_pages: int
