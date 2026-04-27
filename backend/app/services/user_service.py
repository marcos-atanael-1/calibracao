from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.utils.security import hash_password


class UserService:

    @staticmethod
    def get_all(db: Session) -> list[User]:
        return db.query(User).order_by(User.name).all()

    @staticmethod
    def get_by_id(db: Session, user_id: UUID) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado",
            )
        return user

    @staticmethod
    def create(db: Session, data: UserCreate) -> User:
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"E-mail '{data.email}' já está em uso",
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
    def update(db: Session, user_id: UUID, data: UserUpdate) -> User:
        user = UserService.get_by_id(db, user_id)
        update_data = data.model_dump(exclude_unset=True)

        # Check email uniqueness if changing
        if "email" in update_data:
            existing = db.query(User).filter(
                User.email == update_data["email"],
                User.id != user_id,
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="E-mail já está em uso por outro usuário",
                )

        for field, value in update_data.items():
            setattr(user, field, value)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def delete(db: Session, user_id: UUID) -> None:
        user = UserService.get_by_id(db, user_id)
        db.delete(user)
        db.commit()

    @staticmethod
    def reset_password(db: Session, user_id: UUID, new_password: str) -> User:
        user = UserService.get_by_id(db, user_id)
        user.password_hash = hash_password(new_password)
        user.must_change_password = True
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def change_own_password(db: Session, user_id: UUID, new_password: str) -> User:
        """User changes their own password (first login or voluntary)."""
        user = UserService.get_by_id(db, user_id)
        user.password_hash = hash_password(new_password)
        user.must_change_password = False
        db.commit()
        db.refresh(user)
        return user
