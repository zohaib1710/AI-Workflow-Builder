from app.config import Settings
from app.providers.exceptions import AIProviderConfigurationError
from app.providers.factory import create_ai_provider
from app.providers.openai_compatible import OpenAICompatibleProvider


def test_factory_creates_openai_compatible_provider_without_network() -> None:
    provider = create_ai_provider(Settings())

    assert isinstance(provider, OpenAICompatibleProvider)
    assert provider.base_url == "https://api.groq.com/openai/v1"


def test_factory_rejects_unknown_provider() -> None:
    settings = Settings.model_construct(
        ai_provider="unknown",
        ai_api_key="",
        ai_base_url="https://example.com/v1",
        ai_model="model",
        ai_temperature=0.2,
        ai_max_tokens=8000,
        ai_timeout_seconds=30,
        frontend_url="http://localhost:5173",
    )

    try:
        create_ai_provider(settings)
    except AIProviderConfigurationError as error:
        assert "unknown" not in str(error)
    else:
        raise AssertionError("unknown provider should fail")


def test_factory_provider_is_configurable_without_a_key() -> None:
    provider = create_ai_provider(Settings())

    assert provider.is_configured is False
