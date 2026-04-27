from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.template import Template, TemplateField
from app.schemas.template import (
    TemplateCreate, TemplateUpdate,
    TemplateFieldCreate, TemplateFieldUpdate,
    TemplateListResponse,
)


class TemplateService:

    @staticmethod
    def get_all(db: Session, active_only: bool = True) -> list[Template]:
        query = db.query(Template)
        if active_only:
            query = query.filter(Template.is_active == True)
        return query.order_by(Template.name).all()

    @staticmethod
    def get_by_id(db: Session, template_id: UUID) -> Template:
        template = db.query(Template).filter(Template.id == template_id).first()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template não encontrado",
            )
        return template

    @staticmethod
    def create(db: Session, data: TemplateCreate) -> Template:
        # Check unique name
        existing = db.query(Template).filter(Template.name == data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Template com nome '{data.name}' já existe",
            )

        template = Template(
            name=data.name,
            description=data.description,
            excel_template_path=data.excel_template_path,
            default_config=data.default_config,
        )
        db.add(template)
        db.flush()

        # Create fields if provided
        if data.fields:
            for field_data in data.fields:
                field = TemplateField(
                    template_id=template.id,
                    **field_data.model_dump(),
                )
                db.add(field)

        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def update(db: Session, template_id: UUID, data: TemplateUpdate) -> Template:
        template = TemplateService.get_by_id(db, template_id)
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(template, field, value)

        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def delete(db: Session, template_id: UUID) -> None:
        template = TemplateService.get_by_id(db, template_id)
        db.delete(template)
        db.commit()

    # --- Template Fields ---

    @staticmethod
    def add_field(
        db: Session, template_id: UUID, data: TemplateFieldCreate
    ) -> TemplateField:
        # Verify template exists
        TemplateService.get_by_id(db, template_id)

        field = TemplateField(
            template_id=template_id,
            **data.model_dump(),
        )
        db.add(field)
        db.commit()
        db.refresh(field)
        return field

    @staticmethod
    def update_field(
        db: Session, template_id: UUID, field_id: UUID, data: TemplateFieldUpdate
    ) -> TemplateField:
        field = (
            db.query(TemplateField)
            .filter(
                TemplateField.id == field_id,
                TemplateField.template_id == template_id,
            )
            .first()
        )
        if not field:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campo não encontrado",
            )

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(field, key, value)

        db.commit()
        db.refresh(field)
        return field

    @staticmethod
    def delete_field(db: Session, template_id: UUID, field_id: UUID) -> None:
        field = (
            db.query(TemplateField)
            .filter(
                TemplateField.id == field_id,
                TemplateField.template_id == template_id,
            )
            .first()
        )
        if not field:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campo não encontrado",
            )
        db.delete(field)
        db.commit()
