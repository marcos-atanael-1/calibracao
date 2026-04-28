import logging
import uuid
from contextlib import contextmanager

from sqlalchemy import create_engine, text

from config import DATABASE_URL, WORKER_ID

logger = logging.getLogger("worker.db")


class DatabaseClient:
    """Small SQL client dedicated to the RPA worker."""

    QUEUE_STATUS = {
        "pending": "PENDING",
        "processing": "PROCESSING",
        "done": "DONE",
        "error": "ERROR",
    }

    CERTIFICATE_STATUS = {
        "pending": "QUEUED",
        "processing": "PROCESSING",
        "done": "DONE",
        "error": "ERROR",
    }

    def __init__(self):
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL não configurada para o worker")

        self.engine = create_engine(
            DATABASE_URL,
            future=True,
            pool_pre_ping=True,
        )

    @contextmanager
    def _connection(self):
        with self.engine.begin() as conn:
            yield conn

    def claim_next_queue_item(self):
        """Atomically claim the next pending queue item."""
        stmt = text(
            """
            WITH next_item AS (
                SELECT id
                FROM processing_queue
                WHERE status = :pending_status
                ORDER BY created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE processing_queue AS pq
            SET status = :processing_status,
                started_at = NOW(),
                worker_id = :worker_id,
                error_message = NULL
            FROM next_item
            WHERE pq.id = next_item.id
            RETURNING
                pq.id,
                pq.certificate_id,
                pq.status,
                pq.retry_count,
                pq.max_retries,
                pq.error_message,
                pq.worker_id,
                pq.started_at,
                pq.completed_at,
                pq.created_at
            """
        )
        with self._connection() as conn:
            row = conn.execute(
                stmt,
                {
                    "worker_id": WORKER_ID,
                    "pending_status": self.QUEUE_STATUS["pending"],
                    "processing_status": self.QUEUE_STATUS["processing"],
                },
            ).mappings().first()
            return dict(row) if row else None

    def get_certificate(self, certificate_id):
        cert_stmt = text(
            """
            SELECT
                c.id,
                c.template_id,
                c.created_by,
                c.certificate_number,
                c.instrument_tag,
                c.instrument_description,
                c.manufacturer,
                c.model,
                c.serial_number,
                c.range_min,
                c.range_max,
                c.unit,
                c.extra_fields,
                c.status,
                c.pdf_path,
                c.ai_summary,
                c.calibration_date,
                c.created_at,
                c.updated_at
            FROM certificates c
            WHERE c.id = :certificate_id
            """
        )
        points_stmt = text(
            """
            SELECT
                id,
                point_number,
                nominal_value,
                measured_value,
                error_value,
                uncertainty,
                unit,
                excel_row_ref
            FROM certificate_points
            WHERE certificate_id = :certificate_id
            ORDER BY point_number ASC
            """
        )

        with self.engine.connect() as conn:
            cert = conn.execute(
                cert_stmt, {"certificate_id": certificate_id}
            ).mappings().first()
            if not cert:
                return None

            points = conn.execute(
                points_stmt, {"certificate_id": certificate_id}
            ).mappings().all()

        certificate = dict(cert)
        certificate["points"] = [dict(point) for point in points]
        return certificate

    def get_template(self, template_id):
        template_stmt = text(
            """
            SELECT
                id,
                name,
                description,
                excel_template_path,
                default_config,
                is_active,
                created_at,
                updated_at
            FROM templates
            WHERE id = :template_id
            """
        )
        fields_stmt = text(
            """
            SELECT
                id,
                template_id,
                field_key,
                label,
                field_type,
                options,
                excel_cell_ref,
                display_order,
                is_required
            FROM template_fields
            WHERE template_id = :template_id
            ORDER BY display_order ASC, field_key ASC
            """
        )

        with self.engine.connect() as conn:
            template = conn.execute(
                template_stmt, {"template_id": template_id}
            ).mappings().first()
            if not template:
                return None

            fields = conn.execute(
                fields_stmt, {"template_id": template_id}
            ).mappings().all()

        template_data = dict(template)
        template_data["fields"] = [dict(field) for field in fields]
        return template_data

    def update_queue_status(
        self,
        queue_id,
        status,
        error_message=None,
        pdf_path=None,
        worker_id=None,
    ):
        queue_stmt = text(
            """
            UPDATE processing_queue
            SET
                status = :status,
                worker_id = COALESCE(:worker_id, worker_id),
                error_message = :error_message,
                completed_at = CASE
                    WHEN :status IN ('DONE', 'ERROR') THEN NOW()
                    ELSE completed_at
                END,
                retry_count = CASE
                    WHEN :status = 'ERROR' THEN retry_count + 1
                    ELSE retry_count
                END
            WHERE id = :queue_id
            RETURNING certificate_id
            """
        )
        cert_stmt = text(
            """
            UPDATE certificates
            SET
                status = :certificate_status,
                pdf_path = COALESCE(:pdf_path, pdf_path)
            WHERE id = :certificate_id
            """
        )
        notification_context_stmt = text(
            """
            SELECT
                c.created_by AS user_id,
                c.certificate_number
            FROM certificates c
            WHERE c.id = :certificate_id
            """
        )
        notification_insert_stmt = text(
            """
            INSERT INTO notifications (
                id,
                user_id,
                certificate_id,
                queue_id,
                title,
                message,
                notification_type,
                is_read,
                created_at
            ) VALUES (
                :notification_id,
                :user_id,
                :certificate_id,
                :queue_id,
                :title,
                :message,
                :notification_type,
                false,
                NOW()
            )
            """
        )
        queue_status = self.QUEUE_STATUS.get(status, status)
        certificate_status = self.CERTIFICATE_STATUS.get(status, status)

        with self._connection() as conn:
            row = conn.execute(
                queue_stmt,
                {
                    "queue_id": queue_id,
                    "status": queue_status,
                    "worker_id": worker_id,
                    "error_message": error_message,
                },
            ).mappings().first()

            if not row:
                logger.warning("Item da fila não encontrado: %s", queue_id)
                return None

            conn.execute(
                cert_stmt,
                {
                    "certificate_id": row["certificate_id"],
                    "certificate_status": certificate_status,
                    "pdf_path": pdf_path,
                },
            )

            if queue_status in ("DONE", "ERROR"):
                context = conn.execute(
                    notification_context_stmt,
                    {"certificate_id": row["certificate_id"]},
                ).mappings().first()

                if context and context.get("user_id"):
                    if queue_status == "DONE":
                        title = "Certificado finalizado"
                        message = (
                            f"O Agente concluiu a geracao do certificado "
                            f"{context['certificate_number']}."
                        )
                        notification_type = "success"
                    else:
                        title = "Falha no processamento"
                        message = (
                            f"O Agente encontrou um erro ao processar o certificado "
                            f"{context['certificate_number']}."
                        )
                        notification_type = "error"

                    conn.execute(
                        notification_insert_stmt,
                        {
                            "notification_id": str(uuid.uuid4()),
                            "user_id": context["user_id"],
                            "certificate_id": row["certificate_id"],
                            "queue_id": queue_id,
                            "title": title,
                            "message": message,
                            "notification_type": notification_type,
                        },
                    )

        return True
