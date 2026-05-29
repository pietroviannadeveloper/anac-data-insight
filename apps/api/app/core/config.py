from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "sqlite:///./anac_data_insight.db"
    upload_dir: str = "./uploads"
    generated_dir: str = "./generated"
    max_upload_size_mb: int = 50
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    ai_provider: str = "openai"
    environment: str = "development"
    cors_origins: List[str] = ["http://localhost:3000"]

    # Auth
    secret_key: str = "insecure-dev-secret-change-in-production"
    auth_username: str = "pietro.rocha"
    auth_password: str = "Pietro007@"
    access_token_expire_minutes: int = 480  # 8 horas


settings = Settings()
