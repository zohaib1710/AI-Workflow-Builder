from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend configuration loaded from environment variables or .env."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    ai_provider: str = "openai_compatible"
    ai_api_key: SecretStr = SecretStr("")
    ai_base_url: str = "https://api.groq.com/openai/v1"
    ai_model: str = "openai/gpt-oss-20b"
    ai_temperature: float = 0.2
    ai_max_tokens: int = 6000
    ai_reasoning_effort: Literal["low", "medium", "high"] = "low"
    ai_timeout_seconds: float = 30
    frontend_url: str = "http://localhost:5173"

    @field_validator("ai_provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        if value != "openai_compatible":
            raise ValueError("unsupported AI provider")
        return value

    @field_validator("ai_base_url")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        if not normalized.startswith(("http://", "https://")):
            raise ValueError("AI base URL must use HTTP or HTTPS")
        return normalized

    @field_validator("ai_model")
    @classmethod
    def validate_model(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("AI model must not be blank")
        return normalized

    @field_validator("ai_temperature")
    @classmethod
    def validate_temperature(cls, value: float) -> float:
        if not 0 <= value <= 2:
            raise ValueError("AI temperature must be between 0 and 2")
        return value

    @field_validator("ai_max_tokens", "ai_timeout_seconds")
    @classmethod
    def validate_positive(cls, value: float) -> int | float:
        if value <= 0:
            raise ValueError("AI limits must be greater than zero")
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the shared backend settings instance."""
    return Settings()
