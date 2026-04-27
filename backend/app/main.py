import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from alembic.config import Config
from alembic import command

from app.config import settings

logger = logging.getLogger(__name__)


def run_migrations():
    """Run all pending Alembic migrations on startup."""
    try:
        alembic_cfg = Config("alembic.ini")
        alembic_url = settings.DATABASE_URL.replace("%", "%%")
        alembic_cfg.set_main_option("sqlalchemy.url", alembic_url)
        command.upgrade(alembic_cfg, "head")
        logger.info("✅ Migrations aplicadas com sucesso")
    except Exception as e:
        logger.error(f"❌ Erro ao aplicar migrations: {e}")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info(f"🚀 Iniciando {settings.APP_NAME} v{settings.APP_VERSION}")

    # Ensure storage directories exist
    os.makedirs(settings.PDF_STORAGE_PATH, exist_ok=True)

    # Run pending migrations
    run_migrations()

    # Seed default settings
    from app.database import SessionLocal
    from app.services.setting_service import SettingService
    try:
        db = SessionLocal()
        SettingService.seed_defaults(db)
        db.close()
        logger.info("✅ Settings padrão verificados")
    except Exception as e:
        logger.warning(f"⚠️ Erro ao verificar settings padrão: {e}")

    yield

    # Shutdown
    logger.info("🛑 Encerrando aplicação")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from app.routers import auth, templates, certificates, queue, users, settings as settings_router

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(templates.router, prefix="/api/v1")
app.include_router(certificates.router, prefix="/api/v1")
app.include_router(queue.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}
