from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.processing_queue import ProcessingQueue, QueueStatus
from app.models.certificate import Certificate, CertificateStatus
from app.schemas.queue import QueueUpdateRequest


class QueueService:

    @staticmethod
    def get_all(db: Session) -> list[ProcessingQueue]:
        return (
            db.query(ProcessingQueue)
            .options(joinedload(ProcessingQueue.certificate))
            .order_by(ProcessingQueue.created_at.desc())
            .all()
        )

    @staticmethod
    def get_next(db: Session) -> ProcessingQueue | None:
        """Get the next pending item for the worker to process."""
        item = (
            db.query(ProcessingQueue)
            .filter(ProcessingQueue.status == QueueStatus.PENDING)
            .order_by(ProcessingQueue.created_at.asc())
            .first()
        )

        if item:
            item.status = QueueStatus.PROCESSING
            item.started_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(item)

        return item

    @staticmethod
    def update_status(
        db: Session, queue_id: UUID, data: QueueUpdateRequest
    ) -> ProcessingQueue:
        item = db.query(ProcessingQueue).filter(ProcessingQueue.id == queue_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item da fila não encontrado",
            )

        item.status = data.status
        if data.worker_id:
            item.worker_id = data.worker_id
        if data.error_message:
            item.error_message = data.error_message

        # Update certificate status too
        cert = db.query(Certificate).filter(Certificate.id == item.certificate_id).first()

        if data.status == QueueStatus.DONE:
            item.completed_at = datetime.now(timezone.utc)
            if cert:
                cert.status = CertificateStatus.DONE
                if data.pdf_path:
                    cert.pdf_path = data.pdf_path

        elif data.status == QueueStatus.ERROR:
            item.completed_at = datetime.now(timezone.utc)
            item.retry_count += 1
            if cert:
                cert.status = CertificateStatus.ERROR

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def retry(db: Session, queue_id: UUID) -> ProcessingQueue:
        item = db.query(ProcessingQueue).filter(ProcessingQueue.id == queue_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item da fila não encontrado",
            )

        if item.retry_count >= item.max_retries:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Número máximo de tentativas atingido",
            )

        item.status = QueueStatus.PENDING
        item.error_message = None
        item.started_at = None
        item.completed_at = None

        cert = db.query(Certificate).filter(Certificate.id == item.certificate_id).first()
        if cert:
            cert.status = CertificateStatus.QUEUED

        db.commit()
        db.refresh(item)
        return item
