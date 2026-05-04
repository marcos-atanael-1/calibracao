from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.instrument_type import InstrumentType
from app.models.setting import Setting
from app.models.template import Template
from app.schemas.instrument_type import InstrumentTypeCreate, InstrumentTypeUpdate


class InstrumentTypeService:

    @staticmethod
    def get_all(db: Session, active_only: bool = True) -> list[InstrumentType]:
        query = db.query(InstrumentType)
        if active_only:
            query = query.filter(InstrumentType.is_active == True)
        return query.order_by(InstrumentType.name).all()

    @staticmethod
    def get_by_id(db: Session, instrument_type_id: UUID) -> InstrumentType:
        instrument_type = (
            db.query(InstrumentType)
            .filter(InstrumentType.id == instrument_type_id)
            .first()
        )
        if not instrument_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Instrumento nao encontrado",
            )
        return instrument_type

    @staticmethod
    def _validate_template(db: Session, template_id: UUID | None) -> None:
        if not template_id:
            return

        template = db.query(Template).filter(Template.id == template_id).first()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template vinculado ao instrumento nao encontrado",
            )

    @staticmethod
    def create(db: Session, data: InstrumentTypeCreate) -> InstrumentType:
        normalized_name = data.name.strip()
        existing = (
            db.query(InstrumentType)
            .filter(InstrumentType.name == normalized_name)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Instrumento '{normalized_name}' ja existe",
            )

        InstrumentTypeService._validate_template(db, data.template_id)

        instrument_type = InstrumentType(
            name=normalized_name,
            description=data.description,
            template_id=data.template_id,
            is_active=data.is_active,
        )
        db.add(instrument_type)
        db.commit()
        db.refresh(instrument_type)
        return instrument_type

    @staticmethod
    def update(
        db: Session,
        instrument_type_id: UUID,
        data: InstrumentTypeUpdate,
    ) -> InstrumentType:
        instrument_type = InstrumentTypeService.get_by_id(db, instrument_type_id)
        update_data = data.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"] is not None:
            normalized_name = update_data["name"].strip()
            existing = (
                db.query(InstrumentType)
                .filter(
                    InstrumentType.name == normalized_name,
                    InstrumentType.id != instrument_type_id,
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Instrumento '{normalized_name}' ja existe",
                )
            update_data["name"] = normalized_name

        if "template_id" in update_data:
            InstrumentTypeService._validate_template(db, update_data["template_id"])

        for field, value in update_data.items():
            setattr(instrument_type, field, value)

        db.commit()
        db.refresh(instrument_type)
        return instrument_type

    @staticmethod
    def delete(db: Session, instrument_type_id: UUID) -> None:
        instrument_type = InstrumentTypeService.get_by_id(db, instrument_type_id)
        db.delete(instrument_type)
        db.commit()

    @staticmethod
    def seed_from_legacy_settings(db: Session) -> None:
        legacy_setting = db.query(Setting).filter(Setting.key == "instruments").first()
        if not legacy_setting:
            return

        values = legacy_setting.values or []
        if not isinstance(values, list):
            return

        existing_names = {
            name
            for (name,) in db.query(InstrumentType.name).all()
        }
        for value in values:
            normalized_name = str(value or "").strip()
            if not normalized_name or normalized_name in existing_names:
                continue
            db.add(InstrumentType(name=normalized_name, is_active=True))
            existing_names.add(normalized_name)

        db.commit()
