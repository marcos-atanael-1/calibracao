from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.setting import Setting
from app.schemas.setting import SettingCreate, SettingUpdate


class SettingService:

    @staticmethod
    def get_all(db: Session) -> list[Setting]:
        return db.query(Setting).order_by(Setting.label).all()

    @staticmethod
    def get_by_id(db: Session, setting_id: UUID) -> Setting:
        setting = db.query(Setting).filter(Setting.id == setting_id).first()
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuracao nao encontrada",
            )
        return setting

    @staticmethod
    def get_by_key(db: Session, key: str) -> Setting:
        setting = db.query(Setting).filter(Setting.key == key).first()
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuracao '{key}' nao encontrada",
            )
        return setting

    @staticmethod
    def create(db: Session, data: SettingCreate) -> Setting:
        existing = db.query(Setting).filter(Setting.key == data.key).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Configuracao com chave '{data.key}' ja existe",
            )

        setting = Setting(
            key=data.key,
            label=data.label,
            description=data.description,
            values=data.values,
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting

    @staticmethod
    def update(db: Session, setting_id: UUID, data: SettingUpdate) -> Setting:
        setting = SettingService.get_by_id(db, setting_id)
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(setting, field, value)

        db.commit()
        db.refresh(setting)
        return setting

    @staticmethod
    def delete(db: Session, setting_id: UUID) -> None:
        setting = SettingService.get_by_id(db, setting_id)
        db.delete(setting)
        db.commit()

    @staticmethod
    def seed_defaults(db: Session) -> None:
        defaults = [
            {
                "key": "calibration_types",
                "label": "Tipos de Calibracao",
                "description": "Opcoes disponiveis para o campo Tipo da Calibracao",
                "values": ["Acreditado Interno", "Rastreado Interno", "Rastreado Externo"],
            },
            {
                "key": "indication_types",
                "label": "Tipos de Indicacao",
                "description": "Opcoes de tipo de indicacao do instrumento",
                "values": ["Digital", "Analogico"],
            },
            {
                "key": "materials",
                "label": "Materiais",
                "description": "Lista de materiais disponiveis",
                "values": ["Bronze", "Aco Inox", "Vidro", "Polimero"],
            },
            {
                "key": "scopes",
                "label": "Escopos",
                "description": "Escopos de calibracao disponiveis",
                "values": ["Microvolume"],
            },
            {
                "key": "methods",
                "label": "Metodos",
                "description": "Metodos de calibracao",
                "values": ["Gravimetrico"],
            },
            {
                "key": "measurement_units",
                "label": "Unidades de Medicao",
                "description": "Unidades disponiveis para faixa de medicao no formulario",
                "values": ["L", "dL", "cL", "mL", "\u00B5L", "dm\u00B3", "cm\u00B3", "mm\u00B3"],
            },
            {
                "key": "temperature_standards",
                "label": "Padroes de Temperatura",
                "description": "Padroes de temperatura utilizados nas condicoes ambientais",
                "values": [],
            },
            {
                "key": "humidity_standards",
                "label": "Padroes de Umidade",
                "description": "Padroes de umidade utilizados nas condicoes ambientais",
                "values": [],
            },
            {
                "key": "pressure_standards",
                "label": "Padroes de Pressao",
                "description": "Padroes de pressao atmosferica utilizados",
                "values": [],
            },
            {
                "key": "technicians",
                "label": "Tecnicos",
                "description": "Lista de tecnicos disponiveis para selecao no formulario",
                "values": [],
            },
            {
                "key": "balances",
                "label": "Balancas",
                "description": "Balancas utilizadas nos pontos de calibracao",
                "values": [],
            },
            {
                "key": "thermometers",
                "label": "Termometros",
                "description": "Termometros utilizados nos pontos de calibracao",
                "values": [],
            },
            {
                "key": "point_scopes",
                "label": "Escopos do Ponto",
                "description": "Escopos disponiveis dentro dos resultados por ponto",
                "values": ["Dispensadores", "Microvolume", "Picnometro", "Seringa", "Titulador", "Vidraria de Laboratorio"],
            },
            {
                "key": "apparent_mass_units",
                "label": "Unidades de Massa Aparente",
                "description": "Unidades disponiveis para massa aparente",
                "values": ["ug", "mg", "g", "kg"],
            },
            {
                "key": "companies",
                "label": "Empresas",
                "description": "Empresas disponiveis para selecao no formulario",
                "values": [],
            },
            {
                "key": "instruments",
                "label": "Instrumentos",
                "description": "Instrumentos disponiveis para selecao no formulario",
                "values": [],
            },
        ]

        for item in defaults:
            exists = db.query(Setting).filter(Setting.key == item["key"]).first()
            if not exists:
                db.add(Setting(**item))

        db.commit()
