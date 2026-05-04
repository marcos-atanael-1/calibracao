from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    ResetPasswordRequest,
)
from app.schemas.common import APIResponse
from app.services.user_service import UserService
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=APIResponse)
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = UserService.get_all(db, current_user)
    return APIResponse(
        data=[UserResponse.model_validate(u) for u in users],
        message="Lista de usuários",
    )


@router.get("/{user_id}", response_model=APIResponse)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = UserService.get_by_id(db, user_id, current_user)
    return APIResponse(
        data=UserResponse.model_validate(user),
        message="Usuário encontrado",
    )


@router.post("", response_model=APIResponse, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = UserService.create(db, data, current_user)
    return APIResponse(
        data=UserResponse.model_validate(user),
        message="Usuário criado com sucesso",
    )


@router.put("/{user_id}", response_model=APIResponse)
def update_user(
    user_id: UUID,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = UserService.update(db, user_id, data, current_user)
    return APIResponse(
        data=UserResponse.model_validate(user),
        message="Usuário atualizado",
    )


@router.delete("/{user_id}", response_model=APIResponse)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    UserService.delete(db, user_id, current_user)
    return APIResponse(data=None, message="Usuário excluído")


@router.post("/{user_id}/reset-password", response_model=APIResponse)
def reset_password(
    user_id: UUID,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = UserService.reset_password(db, user_id, data.new_password, current_user)
    return APIResponse(
        data=UserResponse.model_validate(user),
        message="Senha redefinida. Usuário deverá trocar no próximo login.",
    )
