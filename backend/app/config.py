from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend configuration loaded from environment variables or .env."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    groq_api_key: str = ""
    groq_model: str = ""
    groq_temperature: float = 0.2
    groq_max_tokens: int = 8000
    frontend_url: str = "http://localhost:5173"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the shared backend settings instance."""
    return Settings()
