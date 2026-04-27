import logging
import os

import requests

from config import API_BASE_URL, WORKER_UPLOAD_TOKEN

logger = logging.getLogger("worker.api")


class WorkerApiClient:
    def __init__(self):
        self.base_url = (API_BASE_URL or "").rstrip("/")

    def upload_pdf(self, certificate_id: str, pdf_path: str) -> str:
        if not self.base_url:
            raise ValueError("API_BASE_URL nao configurada para upload de PDF")

        upload_url = f"{self.base_url}/certificates/{certificate_id}/upload-pdf"
        headers = {}
        if WORKER_UPLOAD_TOKEN:
            headers["X-Worker-Token"] = WORKER_UPLOAD_TOKEN

        with open(pdf_path, "rb") as pdf_file:
            response = requests.post(
                upload_url,
                headers=headers,
                files={"pdf_file": (os.path.basename(pdf_path), pdf_file, "application/pdf")},
                timeout=120,
            )

        response.raise_for_status()
        payload = response.json() or {}
        data = payload.get("data") or {}
        stored_path = data.get("pdf_path")
        if not stored_path:
            raise ValueError("Upload respondeu sem pdf_path")

        logger.info("PDF enviado para API: %s", stored_path)
        return stored_path
