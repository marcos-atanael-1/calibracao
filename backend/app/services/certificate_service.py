from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
import math
import os
import shutil
from pathlib import Path

from app.models.certificate import Certificate, CertificatePoint, CertificateStatus
from app.models.instrument_type import InstrumentType
from app.models.processing_queue import ProcessingQueue, QueueStatus
from app.models.template import Template
from app.models.user import User, UserRole
from app.schemas.certificate import (
    CertificateCreate, CertificateUpdate,
)


class CertificateService:

    @staticmethod
    def _normalize_measurement_unit(value: str | None) -> str | None:
        if value is None:
            return None

        raw = str(value).strip()
        if not raw:
            return raw

        normalized = (
            raw.lower()
            .replace("³", "3")
            .replace("µ", "u")
            .replace("μ", "u")
            .replace(" ", "")
        )

        aliases = {
            "l": "L",
            "dl": "dL",
            "cl": "cL",
            "ml": "mL",
            "ul": "µL",
            "dm3": "dm³",
            "cm3": "cm³",
            "mm3": "mm³",
        }

        return aliases.get(normalized, raw)

    @staticmethod
    def _normalize_extra_fields(extra_fields: dict | None) -> dict:
        normalized = dict(extra_fields or {})
        if "unidade_medicao" in normalized:
            normalized["unidade_medicao"] = CertificateService._normalize_measurement_unit(
                normalized.get("unidade_medicao")
            )
        return normalized

    @staticmethod
    def _can_view_all_certificates(user: User) -> bool:
        return user.role == UserRole.SUPER_ADMIN

    @staticmethod
    def _apply_visibility_scope(query, user: User):
        if CertificateService._can_view_all_certificates(user):
            return query
        return query.filter(Certificate.created_by == user.id)

    @staticmethod
    def _assert_certificate_access(cert: Certificate, user: User) -> None:
        if CertificateService._can_view_all_certificates(user):
            return
        if cert.created_by != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Certificado nao encontrado",
            )

    @staticmethod
    def _resolve_template_id(
        db: Session,
        template_id: UUID | None,
        instrument_name: str | None,
    ) -> UUID:
        if template_id:
            template = db.query(Template).filter(Template.id == template_id).first()
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Template nao encontrado",
                )
            return template.id

        normalized_instrument = (instrument_name or "").strip()
        if normalized_instrument:
            instrument_type = (
                db.query(InstrumentType)
                .filter(InstrumentType.name == normalized_instrument)
                .first()
            )
            if instrument_type and instrument_type.template_id:
                return instrument_type.template_id

            if instrument_type and not instrument_type.template_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="O instrumento selecionado nao possui template vinculado",
                )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template nao informado e nao foi possivel determinar automaticamente pelo instrumento",
        )

    @staticmethod
    def get_stats(db: Session, user: User) -> dict:
        stats = {
            "total": 0,
            "draft": 0,
            "queued": 0,
            "processing": 0,
            "done": 0,
            "error": 0,
        }

        query = db.query(Certificate.status)
        query = CertificateService._apply_visibility_scope(query, user)

        for (status_value,) in query.all():
            stats["total"] += 1
            key = status_value.value if hasattr(status_value, "value") else str(status_value)
            if key in stats:
                stats[key] += 1

        return stats

    @staticmethod
    def get_all(
        db: Session,
        user: User,
        page: int = 1,
        per_page: int = 20,
        status_filter: CertificateStatus | None = None,
        template_id: UUID | None = None,
    ) -> dict:
        query = db.query(Certificate)
        query = CertificateService._apply_visibility_scope(query, user)

        if status_filter:
            query = query.filter(Certificate.status == status_filter)
        if template_id:
            query = query.filter(Certificate.template_id == template_id)

        total = query.count()
        total_pages = math.ceil(total / per_page) if total > 0 else 1

        certificates = (
            query.order_by(Certificate.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return {
            "items": certificates,
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": total_pages,
            },
        }

    @staticmethod
    def get_by_id(
        db: Session,
        certificate_id: UUID,
        user: User | None = None,
    ) -> Certificate:
        cert = (
            db.query(Certificate)
            .options(joinedload(Certificate.points))
            .filter(Certificate.id == certificate_id)
            .first()
        )
        if not cert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Certificado não encontrado",
            )
        if user is not None:
            CertificateService._assert_certificate_access(cert, user)
        return cert

    @staticmethod
    def create(db: Session, data: CertificateCreate, user_id: UUID) -> Certificate:
        # Check unique certificate number
        existing = (
            db.query(Certificate)
            .filter(Certificate.certificate_number == data.certificate_number)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Certificado '{data.certificate_number}' já existe",
            )

        should_enqueue = data.enqueue_for_processing
        normalized_extra_fields = CertificateService._normalize_extra_fields(
            data.extra_fields
        )
        normalized_unit = CertificateService._normalize_measurement_unit(data.unit)
        resolved_template_id = CertificateService._resolve_template_id(
            db,
            data.template_id,
            data.instrument_description or normalized_extra_fields.get("instrumento"),
        )

        cert = Certificate(
            template_id=resolved_template_id,
            created_by=user_id,
            certificate_number=data.certificate_number,
            instrument_tag=data.instrument_tag,
            instrument_description=data.instrument_description,
            manufacturer=data.manufacturer,
            model=data.model,
            serial_number=data.serial_number,
            range_min=data.range_min,
            range_max=data.range_max,
            unit=normalized_unit,
            extra_fields=normalized_extra_fields,
            calibration_date=data.calibration_date,
            status=CertificateStatus.QUEUED if should_enqueue else CertificateStatus.DRAFT,
        )
        db.add(cert)
        db.flush()

        # Create points
        if data.points:
            for point_data in data.points:
                point = CertificatePoint(
                    certificate_id=cert.id,
                    **point_data.model_dump(),
                )
                db.add(point)

        if should_enqueue:
            queue_item = ProcessingQueue(
                certificate_id=cert.id,
                status=QueueStatus.PENDING,
            )
            db.add(queue_item)

        db.commit()
        db.refresh(cert)
        return cert

    @staticmethod
    def update(
        db: Session, certificate_id: UUID, data: CertificateUpdate, user: User
    ) -> Certificate:
        cert = CertificateService.get_by_id(db, certificate_id, user)

        if cert.status != CertificateStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Somente certificados em rascunho podem ser editados",
            )

        should_enqueue = data.enqueue_for_processing

        update_data = data.model_dump(
            exclude_unset=True,
            exclude={"points", "enqueue_for_processing"},
        )
        if "unit" in update_data:
            update_data["unit"] = CertificateService._normalize_measurement_unit(
                update_data.get("unit")
            )
        if "extra_fields" in update_data:
            update_data["extra_fields"] = CertificateService._normalize_extra_fields(
                update_data.get("extra_fields")
            )
        next_instrument_name = update_data.get(
            "instrument_description", cert.instrument_description
        )
        next_extra_fields = update_data.get("extra_fields", cert.extra_fields) or {}

        if "template_id" in update_data:
            update_data["template_id"] = CertificateService._resolve_template_id(
                db,
                update_data.get("template_id"),
                next_instrument_name or next_extra_fields.get("instrumento"),
            )
        elif "instrument_description" in update_data or "extra_fields" in update_data:
            update_data["template_id"] = CertificateService._resolve_template_id(
                db,
                None,
                next_instrument_name or next_extra_fields.get("instrumento"),
            )

        for field, value in update_data.items():
            setattr(cert, field, value)

        # Replace points if provided
        if data.points is not None:
            # Delete existing
            db.query(CertificatePoint).filter(
                CertificatePoint.certificate_id == certificate_id
            ).delete()

            for point_data in data.points:
                point = CertificatePoint(
                    certificate_id=certificate_id,
                    **point_data.model_dump(),
                )
                db.add(point)

        if should_enqueue:
            old_item = (
                db.query(ProcessingQueue)
                .filter(ProcessingQueue.certificate_id == certificate_id)
                .first()
            )
            if old_item:
                db.delete(old_item)
                db.flush()

            queue_item = ProcessingQueue(
                certificate_id=certificate_id,
                status=QueueStatus.PENDING,
            )
            db.add(queue_item)
            cert.status = CertificateStatus.QUEUED

        db.commit()
        db.refresh(cert)
        return cert

    @staticmethod
    def delete(db: Session, certificate_id: UUID, user: User) -> None:
        cert = CertificateService.get_by_id(db, certificate_id, user)
        if cert.status not in (
            CertificateStatus.DRAFT,
            CertificateStatus.QUEUED,
            CertificateStatus.ERROR,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Somente certificados em rascunho ou com erro podem ser excluídos",
            )
        pdf_path = cert.pdf_path

        try:
            db.query(ProcessingQueue).filter(
                ProcessingQueue.certificate_id == certificate_id
            ).delete(synchronize_session=False)

            db.query(CertificatePoint).filter(
                CertificatePoint.certificate_id == certificate_id
            ).delete(synchronize_session=False)

            db.delete(cert)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Nao foi possivel excluir o certificado porque ele possui dependencias vinculadas",
            ) from exc

        if pdf_path and os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
            except OSError:
                pass

    @staticmethod
    def enqueue(db: Session, certificate_id: UUID, user: User) -> ProcessingQueue:
        cert = CertificateService.get_by_id(db, certificate_id, user)

        if cert.status not in (CertificateStatus.DRAFT, CertificateStatus.ERROR):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Certificado já está na fila ou processado",
            )

        # Remove old queue item if exists (retry case)
        old_item = (
            db.query(ProcessingQueue)
            .filter(ProcessingQueue.certificate_id == certificate_id)
            .first()
        )
        if old_item:
            db.delete(old_item)
            db.flush()

        queue_item = ProcessingQueue(
            certificate_id=certificate_id,
            status=QueueStatus.PENDING,
        )
        db.add(queue_item)

        cert.status = CertificateStatus.QUEUED
        db.commit()
        db.refresh(queue_item)
        return queue_item

    @staticmethod
    def store_uploaded_pdf(
        db: Session,
        certificate_id: UUID,
        source_path: str,
        storage_root: str,
        original_filename: str | None = None,
    ) -> str:
        cert = CertificateService.get_by_id(db, certificate_id)

        source = Path(source_path)
        if not source.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivo PDF temporario nao encontrado",
            )

        target_dir = Path(storage_root) / cert.certificate_number
        target_dir.mkdir(parents=True, exist_ok=True)

        filename = original_filename or f"{cert.certificate_number}.pdf"
        safe_filename = Path(filename).name or f"{cert.certificate_number}.pdf"
        if not safe_filename.lower().endswith(".pdf"):
            safe_filename = f"{safe_filename}.pdf"

        target_path = target_dir / safe_filename
        shutil.copy2(source, target_path)

        cert.pdf_path = str(target_path.resolve())
        cert.status = CertificateStatus.DONE
        db.commit()
        db.refresh(cert)

        return cert.pdf_path
