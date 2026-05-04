from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.ai_setup import AISetup
from app.models.user import User, UserRole
from app.schemas.ai_setup import AISetupUpdate, AISetupResponse


class AISetupService:
    DEFAULT_PROVIDER = "openai"
    DEFAULT_MODEL = "gpt-5.4"

    @staticmethod
    def _assert_super_admin(user: User) -> None:
        if user.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas super admin pode gerenciar o IA Setup",
            )

    @staticmethod
    def _mask_api_key(value: str | None) -> str | None:
        if not value:
            return None
        trimmed = value.strip()
        if len(trimmed) <= 8:
            return "*" * len(trimmed)
        return f"{trimmed[:4]}...{trimmed[-4:]}"

    @staticmethod
    def _ensure_singleton(db: Session) -> AISetup:
        setup = db.query(AISetup).filter(AISetup.provider == AISetupService.DEFAULT_PROVIDER).first()
        if setup:
            return setup

        setup = AISetup(
            provider=AISetupService.DEFAULT_PROVIDER,
            openai_model=AISetupService.DEFAULT_MODEL,
            is_enabled=False,
        )
        db.add(setup)
        db.commit()
        db.refresh(setup)
        return setup

    @staticmethod
    def get(db: Session, current_user: User) -> AISetupResponse:
        AISetupService._assert_super_admin(current_user)
        setup = AISetupService._ensure_singleton(db)
        return AISetupService.to_response(setup)

    @staticmethod
    def update(db: Session, data: AISetupUpdate, current_user: User):
        AISetupService._assert_super_admin(current_user)
        setup = AISetupService._ensure_singleton(db)

        if data.openai_api_key is not None:
            incoming_key = data.openai_api_key.strip()
            setup.openai_api_key = incoming_key or None

        setup.openai_model = data.openai_model.strip() or AISetupService.DEFAULT_MODEL
        setup.is_enabled = data.is_enabled and bool(setup.openai_api_key)
        setup.updated_by = current_user.id

        db.commit()
        db.refresh(setup)
        return AISetupService.to_response(setup)

    @staticmethod
    def to_response(setup: AISetup):
        from app.schemas.ai_setup import AISetupResponse

        return AISetupResponse(
            id=setup.id,
            provider=setup.provider,
            openai_model=setup.openai_model,
            is_enabled=setup.is_enabled,
            has_api_key=bool(setup.openai_api_key),
            masked_api_key=AISetupService._mask_api_key(setup.openai_api_key),
            updated_by=setup.updated_by,
            created_at=setup.created_at,
            updated_at=setup.updated_at,
        )
