from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
    ChangePasswordRequest,
)
from app.schemas.common import APIResponse
from app.utils.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    POC: Creates a default admin user if no users exist.
    """
    # POC: Seed default user if DB is empty
    user_count = db.query(User).count()
    if user_count == 0:
        default_user = User(
            name="Admin",
            email="admin@calibracao.com",
            password_hash=hash_password("admin123"),
            role=UserRole.ADMIN,
            must_change_password=False,
        )
        db.add(default_user)
        db.commit()

    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário desativado",
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        must_change_password=user.must_change_password,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(data.refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalido",
        ) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tipo de token invalido",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalido",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario nao encontrado ou inativo",
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        must_change_password=user.must_change_password,
        user=UserResponse.model_validate(user),
    )


@router.post("/change-password", response_model=APIResponse)
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # TODO: Add proper auth dependency to get current user
    # For now we'll accept user_id as a query param (POC)
):
    """
    Change the current user's password.
    Used on first login when must_change_password is True.
    """
    # POC: In production, extract user_id from JWT token
    from fastapi import Query
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Use PUT /users/{id}/change-password instead",
    )


@router.put("/change-password/{user_id}", response_model=APIResponse)
def change_user_password(
    user_id: str,
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Change password for a specific user (first login flow).
    Sets must_change_password to False.
    """
    from uuid import UUID
    target_user_id = UUID(user_id)
    if (
        current_user.id != target_user_id
        and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissao para alterar a senha deste usuario",
        )
    user = UserService.change_own_password(db, target_user_id, data.new_password)
    return APIResponse(
        data=UserResponse.model_validate(user),
        message="Senha alterada com sucesso",
    )
