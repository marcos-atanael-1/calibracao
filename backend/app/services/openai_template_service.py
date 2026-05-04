import base64
import json
from typing import Iterable

from fastapi import HTTPException, status
from openai import OpenAI
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.services.ai_setup_service import AISetupService


class OpenAITemplateService:
    @staticmethod
    def _assert_super_admin(user: User) -> None:
        if user.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas super admin pode usar a extracao de campos por IA",
            )

    @staticmethod
    def _guess_mime_type(filename: str) -> str:
        lower = (filename or "").lower()
        if lower.endswith(".jpg") or lower.endswith(".jpeg"):
            return "image/jpeg"
        if lower.endswith(".webp"):
            return "image/webp"
        return "image/png"

    @staticmethod
    def _normalize_field_type(value: str | None) -> str:
        raw = (value or "text").strip().lower()
        if raw in {"text", "number", "date", "select", "textarea"}:
            return raw
        aliases = {
            "texto": "text",
            "numero": "number",
            "numeric": "number",
            "data": "date",
            "selecao": "select",
            "selectbox": "select",
            "texto_longo": "textarea",
        }
        return aliases.get(raw, "text")

    @staticmethod
    def _normalize_fields(payload_fields: Iterable[dict]) -> list[dict]:
        normalized = []
        for index, field in enumerate(payload_fields or [], start=1):
            normalized.append(
                {
                    "field_key": str(field.get("field_key") or f"campo_{index}").strip(),
                    "label": str(field.get("label") or f"Campo {index}").strip(),
                    "field_type": OpenAITemplateService._normalize_field_type(field.get("field_type")),
                    "excel_cell_ref": (field.get("excel_cell_ref") or None),
                    "display_order": int(field.get("display_order") or index),
                    "is_required": bool(field.get("is_required", False)),
                    "options": field.get("options") if isinstance(field.get("options"), dict) else None,
                    "source_hint": field.get("source_hint") or None,
                }
            )
        return normalized

    @staticmethod
    def extract_fields_from_images(
        db: Session,
        current_user: User,
        files: list[tuple[str, bytes]],
        workbook_context: str | None = None,
    ) -> dict:
        OpenAITemplateService._assert_super_admin(current_user)
        setup = AISetupService._ensure_singleton(db)

        if not setup.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="IA Setup esta desabilitado",
            )
        if not setup.openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhuma chave da OpenAI foi cadastrada no IA Setup",
            )
        if not files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Envie pelo menos uma imagem da planilha",
            )

        client = OpenAI(api_key=setup.openai_api_key)

        content = [
            {
                "type": "input_text",
                "text": (
                    "Analise os prints de uma planilha Excel usada como template de certificado. "
                    "Identifique campos visiveis que provavelmente devem ser cadastrados como template_fields. "
                    "Considere nomes amigaveis, referencias de celula, e sugira field_type entre: text, number, date, select, textarea. "
                    "Responda apenas em JSON valido com o formato: "
                    '{"fields":[{"field_key":"","label":"","field_type":"text","excel_cell_ref":"Dados!F2","display_order":1,"is_required":false,"options":null,"source_hint":""}],"notes":[""]}. '
                    "Nao inclua markdown, comentario nem texto fora do JSON."
                ),
            }
        ]

        if workbook_context:
            content.append(
                {
                    "type": "input_text",
                    "text": f"Contexto adicional informado pelo usuario: {workbook_context}",
                }
            )

        for filename, file_bytes in files:
            mime = OpenAITemplateService._guess_mime_type(filename)
            encoded = base64.b64encode(file_bytes).decode("utf-8")
            content.append(
                {
                    "type": "input_image",
                    "image_url": f"data:{mime};base64,{encoded}",
                }
            )

        try:
            response = client.responses.create(
                model=setup.openai_model,
                input=[{"role": "user", "content": content}],
            )
            raw_output = (response.output_text or "").strip()
            parsed = json.loads(raw_output)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"A resposta da IA nao veio em JSON valido: {exc}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Falha ao consultar a OpenAI: {exc}",
            )

        return {
            "fields": OpenAITemplateService._normalize_fields(parsed.get("fields") or []),
            "notes": [str(note) for note in (parsed.get("notes") or []) if str(note).strip()],
        }
