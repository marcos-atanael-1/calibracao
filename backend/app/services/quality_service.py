from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.models.certificate import (
    Certificate,
    CertificateQualityStatus,
    CertificateStatus,
)
from app.models.certificate_timeline_event import (
    CertificateTimelineEvent,
    TimelineAuthorRole,
)
from app.models.processing_queue import ProcessingQueue, QueueStatus
from app.models.user import User, UserRole
from app.services.notification_service import NotificationService


class QualityService:
    QUALITY_VISIBLE_STATUSES = {
        CertificateQualityStatus.PENDING_REVIEW,
        CertificateQualityStatus.IN_REVIEW,
        CertificateQualityStatus.WAITING_TECHNICIAN,
        CertificateQualityStatus.READY_FOR_REPROCESS,
        CertificateQualityStatus.REPROCESSING,
        CertificateQualityStatus.AWAITING_FINAL_VALIDATION,
        CertificateQualityStatus.APPROVED,
        CertificateQualityStatus.REJECTED,
    }

    @staticmethod
    def _board_visibility_clause():
        return or_(
            Certificate.quality_status != CertificateQualityStatus.PENDING_REVIEW,
            and_(
                Certificate.quality_status == CertificateQualityStatus.PENDING_REVIEW,
                Certificate.status == CertificateStatus.DONE,
                Certificate.review_pdf_path.is_not(None),
            ),
        )
    MANUAL_KANBAN_STATUSES = {
        CertificateQualityStatus.PENDING_REVIEW,
        CertificateQualityStatus.IN_REVIEW,
        CertificateQualityStatus.WAITING_TECHNICIAN,
        CertificateQualityStatus.AWAITING_FINAL_VALIDATION,
    }

    @staticmethod
    def _assert_quality_access(user: User) -> None:
        if user.role not in (UserRole.SUPER_ADMIN, UserRole.QUALIDADE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Voce nao tem permissao para acessar o fluxo da Qualidade",
            )

    @staticmethod
    def _assert_quality_actor(user: User) -> None:
        if user.role not in (UserRole.QUALIDADE, UserRole.SUPER_ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Somente a Qualidade pode executar essa acao",
            )

    @staticmethod
    def _author_role_for(user: User | None) -> TimelineAuthorRole:
        if not user:
            return TimelineAuthorRole.SYSTEM
        mapping = {
            UserRole.SUPER_ADMIN: TimelineAuthorRole.SUPER_ADMIN,
            UserRole.ADMIN: TimelineAuthorRole.ADMIN,
            UserRole.TECNICO: TimelineAuthorRole.TECNICO,
            UserRole.QUALIDADE: TimelineAuthorRole.QUALIDADE,
        }
        return mapping.get(user.role, TimelineAuthorRole.SYSTEM)

    @staticmethod
    def create_timeline_event(
        db: Session,
        *,
        certificate: Certificate,
        event_type: str,
        message: str | None = None,
        actor: User | None = None,
        metadata: dict | None = None,
    ) -> CertificateTimelineEvent:
        event = CertificateTimelineEvent(
            certificate_id=certificate.id,
            author_user_id=actor.id if actor else None,
            author_name=actor.name if actor else None,
            author_role=QualityService._author_role_for(actor),
            event_type=event_type,
            message=message,
            metadata_json=metadata or {},
        )
        db.add(event)
        return event

    @staticmethod
    def list_board(db: Session, actor: User) -> list[Certificate]:
        QualityService._assert_quality_access(actor)
        return (
            db.query(Certificate)
            .options(
                joinedload(Certificate.created_by_user),
                joinedload(Certificate.quality_assigned_user),
            )
            .filter(
                Certificate.quality_status.in_(tuple(QualityService.QUALITY_VISIBLE_STATUSES)),
                Certificate.status != CertificateStatus.DRAFT,
                Certificate.status != CertificateStatus.ERROR,
                QualityService._board_visibility_clause(),
            )
            .order_by(Certificate.updated_at.desc())
            .all()
        )

    @staticmethod
    def get_dashboard_stats(db: Session, actor: User) -> dict:
        QualityService._assert_quality_access(actor)
        stats = {
            "pending_review": 0,
            "in_review": 0,
            "waiting_technician": 0,
            "ready_for_reprocess": 0,
            "reprocessing": 0,
            "awaiting_final_validation": 0,
            "approved": 0,
            "rejected": 0,
            "processing_errors": 0,
        }
        certificates = (
            db.query(Certificate.quality_status, Certificate.status)
            .filter(
                Certificate.quality_status.in_(tuple(QualityService.QUALITY_VISIBLE_STATUSES)),
                Certificate.status != CertificateStatus.DRAFT,
                Certificate.status != CertificateStatus.ERROR,
                QualityService._board_visibility_clause(),
            )
            .all()
        )
        for quality_status, technical_status in certificates:
            key = quality_status.value if hasattr(quality_status, "value") else str(quality_status)
            if key in stats:
                stats[key] += 1
            if technical_status == CertificateStatus.ERROR:
                stats["processing_errors"] += 1
        return stats

    @staticmethod
    def list_timeline(db: Session, certificate_id: UUID, actor: User) -> list[CertificateTimelineEvent]:
        return (
            db.query(CertificateTimelineEvent)
            .filter(CertificateTimelineEvent.certificate_id == certificate_id)
            .order_by(CertificateTimelineEvent.created_at.asc())
            .all()
        )

    @staticmethod
    def move_to_in_review(db: Session, certificate: Certificate, actor: User) -> Certificate:
        QualityService._assert_quality_actor(actor)
        certificate.quality_status = CertificateQualityStatus.IN_REVIEW
        certificate.quality_assigned_to = actor.id
        QualityService.create_timeline_event(
            db,
            certificate=certificate,
            actor=actor,
            event_type="quality_assumed",
            message="A Qualidade assumiu este certificado para analise.",
        )
        NotificationService.create(
            db,
            user_id=certificate.created_by,
            certificate_id=certificate.id,
            title="Certificado em analise da Qualidade",
            message=f"{actor.name} iniciou a analise do certificado {certificate.certificate_number}.",
            notification_type="info",
        )
        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def move_status(
        db: Session,
        certificate: Certificate,
        actor: User,
        target_status: CertificateQualityStatus,
        message: str | None = None,
    ) -> Certificate:
        QualityService._assert_quality_actor(actor)

        if target_status not in QualityService.MANUAL_KANBAN_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esse status nao pode ser alterado manualmente no kanban",
            )

        certificate.quality_status = target_status
        if target_status in {
            CertificateQualityStatus.IN_REVIEW,
            CertificateQualityStatus.WAITING_TECHNICIAN,
        }:
            certificate.quality_assigned_to = actor.id
        elif target_status == CertificateQualityStatus.PENDING_REVIEW:
            certificate.quality_assigned_to = None

        QualityService.create_timeline_event(
            db,
            certificate=certificate,
            actor=actor,
            event_type="quality_status_moved",
            message=message or f"Status movido para {target_status.value}.",
            metadata={"target_status": target_status.value},
        )

        if target_status == CertificateQualityStatus.WAITING_TECHNICIAN:
            NotificationService.create(
                db,
                user_id=certificate.created_by,
                certificate_id=certificate.id,
                title="Certificado aguardando ajuste tecnico",
                message=message or f"A Qualidade moveu o certificado {certificate.certificate_number} para aguardando tecnico.",
                notification_type="warning",
            )

        if target_status == CertificateQualityStatus.IN_REVIEW:
            NotificationService.create(
                db,
                user_id=certificate.created_by,
                certificate_id=certificate.id,
                title="Certificado em analise da Qualidade",
                message=message or f"{actor.name} colocou o certificado {certificate.certificate_number} em analise.",
                notification_type="info",
            )

        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def add_comment(
        db: Session,
        certificate: Certificate,
        actor: User,
        message: str,
    ) -> Certificate:
        QualityService.create_timeline_event(
            db,
            certificate=certificate,
            actor=actor,
            event_type="comment",
            message=message,
        )
        recipients = [certificate.created_by]
        if actor.role == UserRole.TECNICO and certificate.quality_assigned_to:
            recipients.append(certificate.quality_assigned_to)
        elif actor.role == UserRole.QUALIDADE:
            recipients.append(certificate.created_by)

        NotificationService.create_many(
            db,
            user_ids=recipients,
            certificate_id=certificate.id,
            title="Novo comentario no certificado",
            message=message,
            notification_type="info",
        )
        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def return_to_technician(
        db: Session,
        certificate: Certificate,
        actor: User,
        message: str,
    ) -> Certificate:
        QualityService._assert_quality_actor(actor)
        certificate.quality_status = CertificateQualityStatus.WAITING_TECHNICIAN
        certificate.quality_assigned_to = actor.id
        certificate.requires_reprocess = False
        QualityService.create_timeline_event(
            db,
            certificate=certificate,
            actor=actor,
            event_type="returned_to_technician",
            message=message,
        )
        NotificationService.create(
            db,
            user_id=certificate.created_by,
            certificate_id=certificate.id,
            title="Ajustes solicitados pela Qualidade",
            message=message,
            notification_type="warning",
        )
        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def request_reprocess(
        db: Session,
        certificate: Certificate,
        actor: User,
        message: str | None = None,
    ) -> Certificate:
        allowed_roles = {UserRole.SUPER_ADMIN, UserRole.QUALIDADE, UserRole.TECNICO}
        if actor.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Voce nao pode solicitar novo processamento",
            )

        if actor.role == UserRole.TECNICO and certificate.created_by != actor.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Certificado nao encontrado",
            )

        if actor.role == UserRole.TECNICO and certificate.quality_status != CertificateQualityStatus.WAITING_TECHNICIAN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O tecnico so pode reenviar certificados devolvidos pela Qualidade",
            )

        if certificate.status in (CertificateStatus.QUEUED, CertificateStatus.PROCESSING):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este certificado ja esta em processamento pelo Agente",
            )

        old_item = (
            db.query(ProcessingQueue)
            .filter(ProcessingQueue.certificate_id == certificate.id)
            .first()
        )
        if old_item:
            db.delete(old_item)
            db.flush()

        queue_item = ProcessingQueue(
            certificate_id=certificate.id,
            status=QueueStatus.PENDING,
        )
        db.add(queue_item)

        certificate.status = CertificateStatus.QUEUED
        certificate.requires_reprocess = True
        certificate.quality_status = CertificateQualityStatus.READY_FOR_REPROCESS

        event_type = (
            "quality_requested_reprocess"
            if actor.role in (UserRole.QUALIDADE, UserRole.SUPER_ADMIN)
            else "technician_requested_reprocess"
        )
        QualityService.create_timeline_event(
            db,
            certificate=certificate,
            actor=actor,
            event_type=event_type,
            message=message or "Certificado enviado para nova geracao pelo Agente.",
        )

        recipients = [certificate.created_by]
        if certificate.quality_assigned_to:
            recipients.append(certificate.quality_assigned_to)

        NotificationService.create_many(
            db,
            user_ids=recipients,
            certificate_id=certificate.id,
            queue_id=queue_item.id,
            title="Certificado enviado para nova geracao",
            message=message or f"O certificado {certificate.certificate_number} entrou novamente na fila do Agente.",
            notification_type="info",
        )

        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def approve(db: Session, certificate: Certificate, actor: User) -> Certificate:
        QualityService._assert_quality_actor(actor)
        now = datetime.now(timezone.utc)
        certificate.quality_status = CertificateQualityStatus.APPROVED
        certificate.quality_assigned_to = actor.id
        certificate.quality_approved_at = now
        certificate.quality_rejected_at = None
        if certificate.source_pdf_path:
            certificate.official_pdf_path = certificate.source_pdf_path
            certificate.pdf_path = certificate.official_pdf_path

        QualityService.create_timeline_event(
            db,
            certificate=certificate,
            actor=actor,
            event_type="approved",
            message="Certificado aprovado pela Qualidade.",
        )
        NotificationService.create(
            db,
            user_id=certificate.created_by,
            certificate_id=certificate.id,
            title="Certificado aprovado pela Qualidade",
            message=f"O certificado {certificate.certificate_number} agora possui versao oficial liberada para download.",
            notification_type="success",
        )
        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def reject(db: Session, certificate: Certificate, actor: User, message: str) -> Certificate:
        QualityService._assert_quality_actor(actor)
        now = datetime.now(timezone.utc)
        certificate.quality_status = CertificateQualityStatus.REJECTED
        certificate.quality_assigned_to = actor.id
        certificate.quality_rejected_at = now
        QualityService.create_timeline_event(
            db,
            certificate=certificate,
            actor=actor,
            event_type="rejected",
            message=message,
        )
        NotificationService.create(
            db,
            user_id=certificate.created_by,
            certificate_id=certificate.id,
            title="Certificado rejeitado pela Qualidade",
            message=message,
            notification_type="error",
        )
        db.commit()
        db.refresh(certificate)
        return certificate
