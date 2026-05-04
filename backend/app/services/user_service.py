from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.utils.security import hash_password


class UserService:

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
        if target.role == UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin nao pode gerenciar usuarios super admin",
            )

    @staticmethod
    def get_all(db: Session, actor: User) -> list[User]:
        UserService._assert_user_module_access(actor)
        query = db.query(User)
        if actor.role == UserRole.ADMIN:
            query = query.filter(User.role != UserRole.SUPER_ADMIN)
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
