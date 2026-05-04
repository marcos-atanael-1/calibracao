from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.services.queue_service import QueueService
from app.schemas.queue import QueueItemResponse, QueueUpdateRequest
from app.schemas.common import APIResponse

router = APIRouter(prefix="/queue", tags=["Queue"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=APIResponse)
def list_queue(db: Session = Depends(get_db)):
    """List all queue items (admin dashboard)."""
    items = QueueService.get_all(db)
    return APIResponse(
        data=[QueueItemResponse.model_validate(i).model_dump() for i in items]
    )


@router.get("/next", response_model=APIResponse)
def get_next_item(db: Session = Depends(get_db)):
    """Get next pending item for worker processing."""
    item = QueueService.get_next(db)
    if not item:
        return APIResponse(data=None, message="Fila vazia")
    return APIResponse(
        data=QueueItemResponse.model_validate(item).model_dump()
    )


@router.patch("/{queue_id}", response_model=APIResponse)
def update_queue_item(
    queue_id: UUID,
    data: QueueUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update queue item status (used by worker)."""
    item = QueueService.update_status(db, queue_id, data)
    return APIResponse(
        data=QueueItemResponse.model_validate(item).model_dump(),
        message="Status atualizado",
    )


@router.post("/{queue_id}/retry", response_model=APIResponse)
def retry_queue_item(queue_id: UUID, db: Session = Depends(get_db)):
    """Retry a failed queue item (admin)."""
    item = QueueService.retry(db, queue_id)
    return APIResponse(
        data=QueueItemResponse.model_validate(item).model_dump(),
        message="Item reenviado para processamento",
    )


@router.delete("/{queue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_queue_item(
    queue_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    QueueService.delete_queue_item(db, queue_id, current_user)


@router.delete("/{queue_id}/certificate", status_code=status.HTTP_204_NO_CONTENT)
def delete_queue_certificate(
    queue_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    QueueService.delete_queue_certificate(db, queue_id, current_user)
