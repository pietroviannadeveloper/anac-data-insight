from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "sqlite:///./anac_data_insight.db"
    upload_dir: str = "./uploads"
    generated_dir: str = "./generated"
    max_upload_size_mb: int = 50
    # Gemini (preferred)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # OpenAI (fallback)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Legacy — kept for compatibility but provider is now auto-detected
    ai_provider: str = "auto"
    environment: str = "development"
    cors_origins: List[str] = ["http://localhost:3000"]

    # Email — opcional; deixar vazios para desabilitar envios
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_tls: bool = True

    # Auth
    secret_key: str = "insecure-dev-secret-change-in-production"
    auth_username: str = "pietro.rocha"
    auth_password: str = "Pietro007@"
    access_token_expire_minutes: int = 480  # 8 horas


settings = Settings()
