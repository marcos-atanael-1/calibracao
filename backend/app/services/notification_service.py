import uuid
from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.notification import Notification


class NotificationService:
    @staticmethod
    def create(
        db: Session,
        *,
        user_id,
        title: str,
        message: str,
        notification_type: str = "info",
        certificate_id=None,
        queue_id=None,
    ) -> Notification:
        notification = Notification(
            id=uuid.uuid4(),
            user_id=user_id,
            certificate_id=certificate_id,
            queue_id=queue_id,
            title=title,
            message=message,
            notification_type=notification_type,
        )
        db.add(notification)
        return notification

    @staticmethod
    def create_many(
        db: Session,
        *,
        user_ids: Iterable,
        title: str,
        message: str,
        notification_type: str = "info",
        certificate_id=None,
        queue_id=None,
    ) -> list[Notification]:
        notifications: list[Notification] = []
        seen: set[str] = set()
        for user_id in user_ids:
            key = str(user_id)
            if key in seen:
                continue
            seen.add(key)
            notifications.append(
                NotificationService.create(
                    db,
                    user_id=user_id,
                    title=title,
                    message=message,
                    notification_type=notification_type,
                    certificate_id=certificate_id,
                    queue_id=queue_id,
                )
            )
        return notifications
