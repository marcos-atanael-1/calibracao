from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.ai_setup import AISetupUpdate
from app.schemas.common import APIResponse
from app.services.ai_setup_service import AISetupService


router = APIRouter(prefix="/ai-setup", tags=["ai-setup"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=APIResponse)
def get_ai_setup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = AISetupService.get(db, current_user)
    return APIResponse(data=data.model_dump(), message="Configuracao de IA")


@router.put("", response_model=APIResponse)
def update_ai_setup(
    payload: AISetupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = AISetupService.update(db, payload, current_user)
    return APIResponse(data=data.model_dump(), message="IA Setup atualizado")
