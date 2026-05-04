from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=APIResponse)
def list_notifications(
    limit: int = Query(10, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None, min_length=1, max_length=255),
    is_read: bool | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if is_read is not None:
        query = query.filter(Notification.is_read.is_(is_read))

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Notification.title.ilike(search_term),
                Notification.message.ilike(search_term),
            )
        )

    total = query.count()
    items = (
        query.order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .count()
    )
    return APIResponse(
        data=[NotificationResponse.model_validate(item).model_dump() for item in items],
        meta={
            "unread_count": unread_count,
            "total": total,
            "limit": limit,
            "offset": offset,
            "search": search or "",
        },
    )


@router.post("/{notification_id}/read", response_model=APIResponse)
def mark_notification_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if notification:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)

    return APIResponse(
        data=NotificationResponse.model_validate(notification).model_dump() if notification else None,
        message="Notificacao marcada como lida",
    )


@router.post("/read-all", response_model=APIResponse, status_code=status.HTTP_200_OK)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .all()
    )
    now = datetime.now(timezone.utc)
    for notification in notifications:
        notification.is_read = True
        notification.read_at = now
    db.commit()

    return APIResponse(message="Todas as notificacoes foram marcadas como lidas")
