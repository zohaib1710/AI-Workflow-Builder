from collections.abc import Callable
from typing import Any

import httpx

from app.providers.exceptions import (
    AIProviderAPIError,
    AIProviderConnectionError,
    AIProviderCredentialError,
    AIProviderRateLimitError,
    AIProviderResponseError,
    AIProviderTimeoutError,
)


class OpenAICompatibleProvider:
    """OpenAI-compatible chat-completions adapter using HTTP only."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        temperature: float,
        max_tokens: int,
        timeout_seconds: float,
        reasoning_effort: str = "low",
        client_factory: Callable[[], httpx.AsyncClient] | None = None,
    ) -> None:
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout_seconds = timeout_seconds
        self.reasoning_effort = reasoning_effort
        self._client_factory = client_factory or self._default_client_factory

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _default_client_factory(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=httpx.Timeout(self.timeout_seconds))

    async def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, object],
    ) -> str:
        if not self.is_configured:
            raise AIProviderCredentialError("AI provider credentials are not configured")

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.temperature,
            "max_completion_tokens": self.max_tokens,
            "reasoning_effort": self.reasoning_effort,
            "include_reasoning": False,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "workflow", "strict": True, "schema": schema},
            },
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        try:
            async with self._client_factory() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise AIProviderTimeoutError("AI provider request timed out") from exc
        except httpx.ConnectError as exc:
            raise AIProviderConnectionError("AI provider connection failed") from exc
        except httpx.RequestError as exc:
            raise AIProviderConnectionError("AI provider transport failed") from exc

        if response.status_code in (401, 403):
            raise AIProviderCredentialError("AI provider credentials were rejected")
        if response.status_code == 429:
            raise AIProviderRateLimitError("AI provider rate limit reached")
        if response.status_code >= 400:
            raise AIProviderAPIError("AI provider request failed")

        try:
            envelope = response.json()
        except ValueError as exc:
            raise AIProviderResponseError("AI provider returned malformed JSON") from exc
        return self._extract_content(envelope)

    @staticmethod
    def _extract_content(envelope: object) -> str:
        if not isinstance(envelope, dict):
            raise AIProviderResponseError("AI provider returned an invalid response envelope")
        choices = envelope.get("choices")
        if not isinstance(choices, list) or not choices:
            raise AIProviderResponseError("AI provider response did not contain choices")
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            raise AIProviderResponseError("AI provider response contained an invalid choice")
        message = first_choice.get("message")
        if not isinstance(message, dict):
            raise AIProviderResponseError("AI provider response did not contain a message")
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise AIProviderResponseError("AI provider response did not contain content")
        return content
