import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.template import Template, TemplateField


ROOT_DIR = Path(__file__).resolve().parent.parent
PRESET_PATH = ROOT_DIR / "template_presets" / "certificado_volume_poc.json"


def upsert_template(db: Session, payload: dict):
    template = db.query(Template).filter(Template.name == payload["name"]).first()
    if not template:
        template = Template(name=payload["name"])
        db.add(template)
        db.flush()

    template.description = payload.get("description")
    template.excel_template_path = payload.get("excel_template_path")
    template.default_config = payload.get("default_config") or {}
    template.is_active = True

    existing_fields = {
        field.field_key: field
        for field in db.query(TemplateField).filter(TemplateField.template_id == template.id).all()
    }

    for field_payload in payload.get("fields", []):
        field = existing_fields.get(field_payload["field_key"])
        if not field:
            field = TemplateField(template_id=template.id, field_key=field_payload["field_key"])
            db.add(field)

        field.label = field_payload["label"]
        field.field_type = field_payload["field_type"]
        field.options = field_payload.get("options")
        field.excel_cell_ref = field_payload.get("excel_cell_ref")
        field.display_order = field_payload.get("display_order", 0)
        field.is_required = field_payload.get("is_required", False)

    db.commit()
    db.refresh(template)
    return template


def main():
    payload = json.loads(PRESET_PATH.read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        template = upsert_template(db, payload)
        print(f"Template pronto: {template.name} ({template.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
