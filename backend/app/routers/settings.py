from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.services.setting_service import SettingService
from app.schemas.setting import SettingCreate, SettingUpdate, SettingResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=APIResponse)
def list_settings(db: Session = Depends(get_db)):
    settings = SettingService.get_all(db)
    return APIResponse(
        data=[SettingResponse.model_validate(s).model_dump() for s in settings]
    )


@router.get("/{key}", response_model=APIResponse)
def get_setting_by_key(key: str, db: Session = Depends(get_db)):
    setting = SettingService.get_by_key(db, key)
    return APIResponse(data=SettingResponse.model_validate(setting).model_dump())


@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
def create_setting(data: SettingCreate, db: Session = Depends(get_db)):
    setting = SettingService.create(db, data)
    return APIResponse(
        data=SettingResponse.model_validate(setting).model_dump(),
        message="Configuração criada com sucesso",
    )


@router.put("/{setting_id}", response_model=APIResponse)
def update_setting(
    setting_id: UUID, data: SettingUpdate, db: Session = Depends(get_db)
):
    setting = SettingService.update(db, setting_id, data)
    return APIResponse(
        data=SettingResponse.model_validate(setting).model_dump(),
        message="Configuração atualizada",
    )


@router.delete("/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_setting(setting_id: UUID, db: Session = Depends(get_db)):
    SettingService.delete(db, setting_id)
