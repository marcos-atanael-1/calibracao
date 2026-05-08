import os
from pathlib import Path
from uuid import UUID, uuid4
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from fastapi import UploadFile

from app.config import settings
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.utils.security import hash_password


class UserService:
    ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
    MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

    @staticmethod
    def _assert_user_module_access(actor: User) -> None:
        if actor.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Voce nao tem permissao para gerenciar usuarios",
            )

    @staticmethod
    def _assert_assignable_role(actor: User, role: UserRole) -> None:
        if actor.role == UserRole.SUPER_ADMIN:
            return
        if actor.role == UserRole.ADMIN and role in (UserRole.ADMIN, UserRole.TECNICO):
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este perfil nao pode conceder esse nivel de acesso",
        )

    @staticmethod
    def _assert_manage_target(actor: User, target: User) -> None:
        UserService._assert_user_module_access(actor)
        if actor.role == UserRole.SUPER_ADMIN:
            return
        if target.role in (UserRole.SUPER_ADMIN, UserRole.QUALIDADE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin nao pode gerenciar usuarios desse nivel de acesso",
            )

    @staticmethod
    def get_all(db: Session, actor: User) -> list[User]:
        UserService._assert_user_module_access(actor)
        query = db.query(User)
        if actor.role == UserRole.ADMIN:
            query = query.filter(User.role.notin_([UserRole.SUPER_ADMIN, UserRole.QUALIDADE]))
        return query.order_by(User.name).all()

    @staticmethod
    def get_by_id(db: Session, user_id: UUID, actor: User) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario nao encontrado",
            )
        UserService._assert_manage_target(actor, user)
        return user

    @staticmethod
    def create(db: Session, data: UserCreate, actor: User) -> User:
        UserService._assert_user_module_access(actor)
        UserService._assert_assignable_role(actor, data.role)

        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"E-mail '{data.email}' ja esta em uso",
            )

        user = User(
            name=data.name,
            email=data.email,
            password_hash=hash_password(data.password),
            role=data.role,
            must_change_password=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update(db: Session, user_id: UUID, data: UserUpdate, actor: User) -> User:
        user = UserService.get_by_id(db, user_id, actor)
        update_data = data.model_dump(exclude_unset=True)

        if "role" in update_data and update_data["role"] is not None:
            UserService._assert_assignable_role(actor, update_data["role"])

        if "email" in update_data:
            existing = db.query(User).filter(
                User.email == update_data["email"],
                User.id != user_id,
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="E-mail ja esta em uso por outro usuario",
                )

        for field, value in update_data.items():
            setattr(user, field, value)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def delete(db: Session, user_id: UUID, actor: User) -> None:
        user = UserService.get_by_id(db, user_id, actor)
        if actor.id == user.id and actor.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin nao pode excluir o proprio acesso por esta tela",
            )
        db.delete(user)
        db.commit()

    @staticmethod
    def reset_password(db: Session, user_id: UUID, new_password: str, actor: User) -> User:
        user = UserService.get_by_id(db, user_id, actor)
        user.password_hash = hash_password(new_password)
        user.must_change_password = True
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def change_own_password(db: Session, user_id: UUID, new_password: str) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario nao encontrado",
            )
        user.password_hash = hash_password(new_password)
        user.must_change_password = False
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def upload_own_avatar(db: Session, actor: User, file: UploadFile) -> User:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in UserService.ALLOWED_AVATAR_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de imagem invalido. Use JPG, PNG ou WEBP",
            )

        content = file.file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivo de imagem vazio",
            )
        if len(content) > UserService.MAX_AVATAR_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A foto deve ter no maximo 5 MB",
            )

        os.makedirs(settings.AVATAR_STORAGE_PATH, exist_ok=True)

        previous_path = actor.avatar_path
        filename = f"{actor.id}-{uuid4().hex}{suffix}"
        absolute_path = Path(settings.AVATAR_STORAGE_PATH) / filename
        absolute_path.write_bytes(content)

        actor.avatar_path = filename
        db.commit()
        db.refresh(actor)

        if previous_path and previous_path != filename:
            old_file = Path(settings.AVATAR_STORAGE_PATH) / previous_path
            if old_file.exists():
                try:
                    old_file.unlink()
                except OSError:
                    pass

        return actor
