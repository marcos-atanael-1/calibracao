import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
UPLOAD_PDF_TO_API = os.getenv("UPLOAD_PDF_TO_API", "false").lower() == "true"
WORKER_UPLOAD_TOKEN = os.getenv("WORKER_UPLOAD_TOKEN", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
WORKER_ID = os.getenv("WORKER_ID", "worker-01")
EXCEL_TIMEOUT = int(os.getenv("EXCEL_TIMEOUT", "120"))
PDF_OUTPUT_DIR = os.getenv("PDF_OUTPUT_DIR", "./output")
TEMPLATES_DIR = os.getenv("TEMPLATES_DIR", "./templates")
KILL_EXCEL_ON_START = os.getenv("KILL_EXCEL_ON_START", "true").lower() == "true"
RUN_MODE = os.getenv("RUN_MODE", "scheduled_once")
TEMPLATE_BASE_DIR = os.getenv("TEMPLATE_BASE_DIR", "../Planilhas")
