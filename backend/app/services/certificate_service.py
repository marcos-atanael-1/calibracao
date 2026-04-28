from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
import math
import os
import shutil
from pathlib import Path

from app.models.certificate import Certificate, CertificatePoint, CertificateStatus
from app.models.processing_queue import ProcessingQueue, QueueStatus
from app.schemas.certificate import (
    CertificateCreate, CertificateUpdate,
)


class CertificateService:

    @staticmethod
    def get_stats(db: Session) -> dict:
        stats = {
            "total": 0,
            "draft": 0,
            "queued": 0,
            "processing": 0,
            "done": 0,
            "error": 0,
        }

        for (status_value,) in db.query(Certificate.status).all():
            stats["total"] += 1
            key = status_value.value if hasattr(status_value, "value") else str(status_value)
            if key in stats:
                stats[key] += 1

        return stats

    @staticmethod
    def get_all(
        db: Session,
        page: int = 1,
        per_page: int = 20,
        status_filter: CertificateStatus | None = None,
        template_id: UUID | None = None,
    ) -> dict:
        query = db.query(Certificate)

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
    def get_by_id(db: Session, certificate_id: UUID) -> Certificate:
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

        cert = Certificate(
            template_id=data.template_id,
            created_by=user_id,
            certificate_number=data.certificate_number,
            instrument_tag=data.instrument_tag,
            instrument_description=data.instrument_description,
            manufacturer=data.manufacturer,
            model=data.model,
            serial_number=data.serial_number,
            range_min=data.range_min,
            range_max=data.range_max,
            unit=data.unit,
            extra_fields=data.extra_fields,
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
        db: Session, certificate_id: UUID, data: CertificateUpdate
    ) -> Certificate:
        cert = CertificateService.get_by_id(db, certificate_id)

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
    def delete(db: Session, certificate_id: UUID) -> None:
        cert = CertificateService.get_by_id(db, certificate_id)
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
    def enqueue(db: Session, certificate_id: UUID) -> ProcessingQueue:
        cert = CertificateService.get_by_id(db, certificate_id)

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
