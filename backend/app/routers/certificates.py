import os
from tempfile import NamedTemporaryFile
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.certificate import CertificateStatus
from app.models.user import User
from app.schemas.certificate import (
    CertificateCreate,
    CertificateListResponse,
    CertificateResponse,
    CertificateUpdate,
)
from app.schemas.common import APIResponse
from app.schemas.queue import QueueItemResponse
from app.services.certificate_service import CertificateService

router = APIRouter(prefix="/certificates", tags=["Certificates"])


@router.get("/stats", response_model=APIResponse)
def get_certificate_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return APIResponse(data=CertificateService.get_stats(db))


@router.get("", response_model=APIResponse)
def list_certificates(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    status_filter: CertificateStatus | None = None,
    template_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = CertificateService.get_all(
        db,
        page=page,
        per_page=per_page,
        status_filter=status_filter,
        template_id=template_id,
    )
    items = [
        CertificateListResponse.model_validate(c).model_dump()
        for c in result["items"]
    ]
    return APIResponse(data=items, meta=result["meta"])


@router.get("/{certificate_id}", response_model=APIResponse)
def get_certificate(
    certificate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cert = CertificateService.get_by_id(db, certificate_id)
    return APIResponse(
        data=CertificateResponse.model_validate(cert).model_dump()
    )


@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
def create_certificate(
    data: CertificateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cert = CertificateService.create(db, data, user_id=current_user.id)
    return APIResponse(
        data=CertificateResponse.model_validate(cert).model_dump(),
        message="Certificado criado com sucesso",
    )


@router.put("/{certificate_id}", response_model=APIResponse)
def update_certificate(
    certificate_id: UUID,
    data: CertificateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cert = CertificateService.update(db, certificate_id, data)
    return APIResponse(
        data=CertificateResponse.model_validate(cert).model_dump(),
        message="Certificado atualizado",
    )


@router.delete(
    "/{certificate_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_certificate(
    certificate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    CertificateService.delete(db, certificate_id)


@router.post("/{certificate_id}/queue", response_model=APIResponse)
def enqueue_certificate(
    certificate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    queue_item = CertificateService.enqueue(db, certificate_id)
    return APIResponse(
        data=QueueItemResponse.model_validate(queue_item).model_dump(),
        message="Certificado enviado para processamento",
    )


@router.post("/{certificate_id}/upload-pdf", response_model=APIResponse)
def upload_pdf(
    certificate_id: UUID,
    pdf_file: UploadFile = File(...),
    x_worker_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    expected_token = settings.WORKER_UPLOAD_TOKEN.strip()
    if expected_token and x_worker_token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token do agente invalido",
        )

    suffix = os.path.splitext(pdf_file.filename or "")[1] or ".pdf"
    with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = temp_file.name
        pdf_file.file.seek(0)
        temp_file.write(pdf_file.file.read())

    try:
        stored_path = CertificateService.store_uploaded_pdf(
            db,
            certificate_id=certificate_id,
            source_path=temp_path,
            storage_root=settings.PDF_STORAGE_PATH,
            original_filename=pdf_file.filename,
        )
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

    return APIResponse(
        data={"pdf_path": stored_path},
        message="PDF enviado com sucesso",
    )


@router.get("/{certificate_id}/pdf")
def download_pdf(
    certificate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cert = CertificateService.get_by_id(db, certificate_id)
    if not cert.pdf_path or not os.path.exists(cert.pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF nao disponivel",
        )
    return FileResponse(
        cert.pdf_path,
        media_type="application/pdf",
        filename=f"certificado_{cert.certificate_number}.pdf",
    )
