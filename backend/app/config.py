from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Calibração API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://usuario:senha@localhost:5432/calibracao_db"

    # JWT
    SECRET_KEY: str = "placeholder-secret-key-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # CORS
    CORS_ORIGINS: str = '["http://localhost:5173"]'

    # PDF Storage
    PDF_STORAGE_PATH: str = "./storage/pdfs"
    WORKER_UPLOAD_TOKEN: str = ""

    # OpenAI
    OPENAI_API_KEY: str = "placeholder-openai-key"

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
