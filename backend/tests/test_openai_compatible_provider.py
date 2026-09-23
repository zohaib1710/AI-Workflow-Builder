import json

import httpx
import pytest
from app.providers.exceptions import (
    AIProviderAPIError,
    AIProviderConnectionError,
    AIProviderCredentialError,
    AIProviderRateLimitError,
    AIProviderResponseError,
    AIProviderTimeoutError,
)
from app.providers.openai_compatible import OpenAICompatibleProvider


def make_provider(handler, *, base_url: str = "https://example.com/v1", api_key: str = "secret-key"):
    transport = httpx.MockTransport(handler)
    return OpenAICompatibleProvider(
        api_key=api_key,
        base_url=base_url,
        model="model-name",
        temperature=0.4,
        max_tokens=123,
        timeout_seconds=7,
        client_factory=lambda: httpx.AsyncClient(transport=transport),
    )


@pytest.mark.asyncio
async def test_provider_sends_compatible_structured_request() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = request.headers
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"ok": true}'}}]})

    provider = make_provider(handler, base_url="https://example.com/v1/")
    result = await provider.generate_structured(
        system_prompt="system",
        user_prompt="user",
        schema={"type": "object", "additionalProperties": False},
    )

    assert result == '{"ok": true}'
    assert captured["url"] == "https://example.com/v1/chat/completions"
    assert captured["headers"]["authorization"] == "Bearer secret-key"
    assert captured["headers"]["content-type"] == "application/json"
    assert captured["body"]["model"] == "model-name"
    assert captured["body"]["temperature"] == 0.4
    assert captured["body"]["max_completion_tokens"] == 123
    assert captured["body"]["reasoning_effort"] == "low"
    assert captured["body"]["include_reasoning"] is False
    assert "max_tokens" not in captured["body"]
    assert captured["body"]["messages"] == [
        {"role": "system", "content": "system"},
        {"role": "user", "content": "user"},
    ]
    assert captured["body"]["response_format"]["json_schema"]["strict"] is True


@pytest.mark.asyncio
async def test_missing_key_fails_before_http() -> None:
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(500)

    provider = make_provider(handler, api_key="")
    with pytest.raises(AIProviderCredentialError):
        await provider.generate_structured(system_prompt="system", user_prompt="user", schema={})
    assert called is False


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "error_type"),
    [
        (401, AIProviderCredentialError),
        (403, AIProviderCredentialError),
        (429, AIProviderRateLimitError),
        (500, AIProviderAPIError),
    ],
)
async def test_http_errors_are_classified(status: int, error_type: type[Exception]) -> None:
    provider = make_provider(lambda request: httpx.Response(status))

    with pytest.raises(error_type) as failure:
        await provider.generate_structured(system_prompt="system", user_prompt="user", schema={})
    assert "secret-key" not in str(failure.value)


@pytest.mark.asyncio
async def test_timeout_and_connection_errors_are_classified() -> None:
    timeout_provider = make_provider(lambda request: (_ for _ in ()).throw(httpx.ReadTimeout("timed out")))
    connection_provider = make_provider(lambda request: (_ for _ in ()).throw(httpx.ConnectError("failed")))

    with pytest.raises(AIProviderTimeoutError):
        await timeout_provider.generate_structured(system_prompt="system", user_prompt="user", schema={})
    with pytest.raises(AIProviderConnectionError):
        await connection_provider.generate_structured(system_prompt="system", user_prompt="user", schema={})


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "envelope",
    [
        {},
        {"choices": []},
        {"choices": [{}]},
        {"choices": [{"message": {}}]},
        {"choices": [{"message": {"content": ""}}]},
    ],
)
async def test_malformed_success_envelopes_fail_safely(envelope: dict[str, object]) -> None:
    provider = make_provider(lambda request: httpx.Response(200, json=envelope))

    with pytest.raises(AIProviderResponseError) as failure:
        await provider.generate_structured(system_prompt="system", user_prompt="user", schema={})
    assert "secret-key" not in str(failure.value)


def test_provider_has_no_vendor_hostname() -> None:
    with open("backend/app/providers/openai_compatible.py", encoding="utf-8") as provider_file:
        source = provider_file.read()

    assert "api.groq.com" not in source
