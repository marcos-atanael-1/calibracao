from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.services.template_service import TemplateService
from app.services.openai_template_service import OpenAITemplateService
from app.models.user import User
from app.schemas.template import (
    TemplateCreate, TemplateUpdate, TemplateResponse, TemplateListResponse,
    TemplateFieldCreate, TemplateFieldUpdate, TemplateFieldResponse,
)
from app.schemas.common import APIResponse

router = APIRouter(prefix="/templates", tags=["Templates"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=APIResponse)
def list_templates(
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    templates = TemplateService.get_all(db, active_only=active_only)
    items = []
    for t in templates:
        item = TemplateListResponse.model_validate(t)
        item.field_count = len(t.fields)
        items.append(item)
    return APIResponse(data=[i.model_dump() for i in items])


@router.get("/{template_id}", response_model=APIResponse)
def get_template(template_id: UUID, db: Session = Depends(get_db)):
    template = TemplateService.get_by_id(db, template_id)
    return APIResponse(data=TemplateResponse.model_validate(template).model_dump())


@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
def create_template(data: TemplateCreate, db: Session = Depends(get_db)):
    template = TemplateService.create(db, data)
    return APIResponse(
        data=TemplateResponse.model_validate(template).model_dump(),
        message="Template criado com sucesso",
    )


@router.post("/ai-extract-fields", response_model=APIResponse)
async def ai_extract_template_fields(
    workbook_context: str | None = Form(default=None),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file_payloads = []
    for file in files:
        file_payloads.append((file.filename or "image.png", await file.read()))

    data = OpenAITemplateService.extract_fields_from_images(
        db=db,
        current_user=current_user,
        files=file_payloads,
        workbook_context=workbook_context,
    )
    return APIResponse(data=data, message="Campos sugeridos pela IA")


@router.put("/{template_id}", response_model=APIResponse)
def update_template(
    template_id: UUID, data: TemplateUpdate, db: Session = Depends(get_db)
):
    template = TemplateService.update(db, template_id, data)
    return APIResponse(
        data=TemplateResponse.model_validate(template).model_dump(),
        message="Template atualizado",
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: UUID, db: Session = Depends(get_db)):
    TemplateService.delete(db, template_id)


# --- Fields ---

@router.post(
    "/{template_id}/fields",
    response_model=APIResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_field(
    template_id: UUID, data: TemplateFieldCreate, db: Session = Depends(get_db)
):
    field = TemplateService.add_field(db, template_id, data)
    return APIResponse(
        data=TemplateFieldResponse.model_validate(field).model_dump(),
        message="Campo adicionado",
    )


@router.put("/{template_id}/fields/{field_id}", response_model=APIResponse)
def update_field(
    template_id: UUID,
    field_id: UUID,
    data: TemplateFieldUpdate,
    db: Session = Depends(get_db),
):
    field = TemplateService.update_field(db, template_id, field_id, data)
    return APIResponse(
        data=TemplateFieldResponse.model_validate(field).model_dump(),
        message="Campo atualizado",
    )


@router.delete(
    "/{template_id}/fields/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_field(
    template_id: UUID, field_id: UUID, db: Session = Depends(get_db)
):
    TemplateService.delete_field(db, template_id, field_id)
