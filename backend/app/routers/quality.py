from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.certificate import CertificateResponse
from app.schemas.quality import (
    QualityBoardItemResponse,
    QualityCommentRequest,
    QualityCertificateDetailResponse,
    QualityMoveRequest,
    QualityRejectRequest,
    QualityReprocessRequest,
    QualityReturnRequest,
    QualityTimelineEventResponse,
)
from app.services.certificate_service import CertificateService
from app.services.quality_service import QualityService

router = APIRouter(prefix="/quality", tags=["Quality"])


@router.get("/board", response_model=APIResponse)
def get_quality_board(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificates = QualityService.list_board(db, current_user)
    return APIResponse(
        data=[
            QualityBoardItemResponse.model_validate(item).model_dump()
            for item in certificates
        ]
    )


@router.get("/stats", response_model=APIResponse)
def get_quality_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return APIResponse(data=QualityService.get_dashboard_stats(db, current_user))


@router.get("/{certificate_id}", response_model=APIResponse)
def get_quality_certificate(
    certificate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = CertificateService.get_by_id(db, certificate_id, current_user)
    timeline = QualityService.list_timeline(db, certificate_id, current_user)
    return APIResponse(
        data=QualityCertificateDetailResponse(
            certificate=CertificateResponse.model_validate(certificate),
            timeline=[
                QualityTimelineEventResponse.model_validate(item)
                for item in timeline
            ],
        ).model_dump()
    )


@router.post("/{certificate_id}/claim", response_model=APIResponse)
def claim_quality_certificate(
    certificate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = CertificateService.get_by_id(db, certificate_id, current_user)
    certificate = QualityService.move_to_in_review(db, certificate, current_user)
    return APIResponse(
        data=CertificateResponse.model_validate(certificate).model_dump(),
        message="Certificado assumido pela Qualidade",
    )


@router.post("/{certificate_id}/move", response_model=APIResponse)
def move_quality_certificate(
    certificate_id: UUID,
    data: QualityMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = CertificateService.get_by_id(db, certificate_id, current_user)
    certificate = QualityService.move_status(
        db,
        certificate,
        current_user,
        data.target_status,
        data.message,
    )
    return APIResponse(
        data=CertificateResponse.model_validate(certificate).model_dump(),
        message="Status da Qualidade atualizado",
    )


@router.get("/{certificate_id}/timeline", response_model=APIResponse)
def list_quality_timeline(
    certificate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    CertificateService.get_by_id(db, certificate_id, current_user)
    timeline = QualityService.list_timeline(db, certificate_id, current_user)
    return APIResponse(
        data=[
            QualityTimelineEventResponse.model_validate(item).model_dump()
            for item in timeline
        ]
    )


@router.post("/{certificate_id}/comment", response_model=APIResponse)
def add_quality_comment(
    certificate_id: UUID,
    data: QualityCommentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = CertificateService.get_by_id(db, certificate_id, current_user)
    certificate = QualityService.add_comment(db, certificate, current_user, data.message)
    return APIResponse(
        data=CertificateResponse.model_validate(certificate).model_dump(),
        message="Comentario registrado",
    )


@router.post("/{certificate_id}/return", response_model=APIResponse)
def return_to_technician(
    certificate_id: UUID,
    data: QualityReturnRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = CertificateService.get_by_id(db, certificate_id, current_user)
    certificate = QualityService.return_to_technician(
        db, certificate, current_user, data.message
    )
    return APIResponse(
        data=CertificateResponse.model_validate(certificate).model_dump(),
        message="Certificado devolvido ao tecnico",
    )


@router.post("/{certificate_id}/reprocess", response_model=APIResponse)
def request_quality_reprocess(
    certificate_id: UUID,
    data: QualityReprocessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = CertificateService.get_by_id(db, certificate_id, current_user)
    certificate = QualityService.request_reprocess(
        db, certificate, current_user, data.message
    )
    return APIResponse(
        data=CertificateResponse.model_validate(certificate).model_dump(),
        message="Certificado enviado para nova geracao",
    )


@router.post("/{certificate_id}/approve", response_model=APIResponse)
def approve_quality_certificate(
    certificate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = CertificateService.get_by_id(db, certificate_id, current_user)
    certificate = QualityService.approve(db, certificate, current_user)
    return APIResponse(
        data=CertificateResponse.model_validate(certificate).model_dump(),
        message="Certificado aprovado pela Qualidade",
    )


@router.post("/{certificate_id}/reject", response_model=APIResponse)
def reject_quality_certificate(
    certificate_id: UUID,
    data: QualityRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = CertificateService.get_by_id(db, certificate_id, current_user)
    certificate = QualityService.reject(db, certificate, current_user, data.message)
    return APIResponse(
        data=CertificateResponse.model_validate(certificate).model_dump(),
        message="Certificado rejeitado pela Qualidade",
    )
