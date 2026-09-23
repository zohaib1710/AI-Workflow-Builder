from app.config import Settings
from app.providers.base import AIProvider
from app.providers.exceptions import AIProviderConfigurationError
from app.providers.openai_compatible import OpenAICompatibleProvider


def create_ai_provider(settings: Settings) -> AIProvider:
    """Build the configured provider without making a network request."""
    if settings.ai_provider != "openai_compatible":
        raise AIProviderConfigurationError("unsupported AI provider")
    return OpenAICompatibleProvider(
        api_key=settings.ai_api_key.get_secret_value(),
        base_url=settings.ai_base_url,
        model=settings.ai_model,
        temperature=settings.ai_temperature,
        max_tokens=settings.ai_max_tokens,
        timeout_seconds=settings.ai_timeout_seconds,
        reasoning_effort=settings.ai_reasoning_effort,
    )
