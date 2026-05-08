"""
Worker RPA - Main entry point.

This worker is designed to run once per execution, typically from
Windows Task Scheduler. It claims a single pending queue item directly
from PostgreSQL, processes the Excel template, optionally uploads the
generated PDF to the backend API, updates the queue status and exits.

Usage:
    python main.py
"""

import logging
import os
import subprocess
import time
from datetime import datetime

from api_client import WorkerApiClient
from config import (
    KILL_EXCEL_ON_START,
    PDF_OUTPUT_DIR,
    POLL_INTERVAL,
    RUN_MODE,
    UPLOAD_PDF_TO_API,
    WORKER_ID,
)
from db_client import DatabaseClient
from excel_handler import ExcelHandler

os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            f"logs/worker_{datetime.now().strftime('%Y%m%d')}.log",
            encoding="utf-8",
        ),
    ],
)
logger = logging.getLogger("worker")


def kill_excel_processes():
    """Ensure stale Excel processes do not interfere with automation."""
    logger.info("Encerrando processos EXCEL.EXE antes da execucao")
    result = subprocess.run(
        ["taskkill", "/f", "/im", "EXCEL.EXE"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode not in (0, 128):
        logger.warning(
            "taskkill retornou codigo %s: %s",
            result.returncode,
            result.stderr.strip(),
        )


def process_item(db: DatabaseClient, handler: ExcelHandler, queue_item: dict):
    """Process a single queue item."""
    queue_id = queue_item["id"]
    certificate_id = queue_item["certificate_id"]

    logger.info("Processando: certificado=%s, fila=%s", certificate_id, queue_id)

    certificate = db.get_certificate(certificate_id)
    if not certificate:
        db.update_queue_status(
            queue_id,
            "error",
            error_message="Certificado nao encontrado",
            worker_id=WORKER_ID,
        )
        return

    template = db.get_template(certificate["template_id"])
    if not template:
        db.update_queue_status(
            queue_id,
            "error",
            error_message="Template nao encontrado",
            worker_id=WORKER_ID,
        )
        return

    try:
        pdf_path = handler.process(certificate, template)
        stored_pdf_path = pdf_path

        if UPLOAD_PDF_TO_API:
            api_client = WorkerApiClient()
            stored_pdf_path = api_client.upload_pdf(str(certificate_id), pdf_path)

        db.update_queue_status(
            queue_id,
            "done",
            pdf_path=stored_pdf_path,
            worker_id=WORKER_ID,
        )
        logger.info("Concluido: %s", certificate["certificate_number"])
    except FileNotFoundError as exc:
        logger.error("Arquivo nao encontrado: %s", exc)
        db.update_queue_status(
            queue_id,
            "error",
            error_message=str(exc),
            worker_id=WORKER_ID,
        )
    except Exception as exc:
        logger.error("Erro no processamento: %s", exc, exc_info=True)
        db.update_queue_status(
            queue_id,
            "error",
            error_message=str(exc),
            worker_id=WORKER_ID,
        )


def run_once(db: DatabaseClient, handler: ExcelHandler) -> bool:
    """Try to process a single queue item.

    Returns True when an item was claimed, False otherwise.
    """
    item = db.claim_next_queue_item()
    if not item:
        logger.info("Nenhum item pendente na fila")
        return False

    process_item(db, handler, item)
    return True


def main():
    """Run the worker once or continuously depending on RUN_MODE."""
    logger.info("Worker RPA iniciado (ID: %s, modo: %s)", WORKER_ID, RUN_MODE)
    os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)

    if KILL_EXCEL_ON_START:
        kill_excel_processes()

    db = DatabaseClient()
    handler = ExcelHandler()

    try:
        if RUN_MODE == "continuous":
            logger.info(
                "Modo continuo ativo; verificando fila a cada %s segundo(s)",
                POLL_INTERVAL,
            )
            while True:
                claimed = run_once(db, handler)
                if not claimed:
                    time.sleep(max(1, POLL_INTERVAL))
                    continue

                time.sleep(max(1, POLL_INTERVAL))
            return

        run_once(db, handler)
    except KeyboardInterrupt:
        logger.info("Worker encerrado pelo usuario")
    except Exception as exc:
        logger.error("Erro na execucao do worker: %s", exc, exc_info=True)
        raise


if __name__ == "__main__":
    main()
