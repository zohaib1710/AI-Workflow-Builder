from collections.abc import Iterator

import pytest
from app.api.routes.workflows import get_workflow_generation_service
from app.main import app
from app.providers.exceptions import (
    AIProviderAPIError,
    AIProviderConfigurationError,
    AIProviderConnectionError,
    AIProviderCredentialError,
    AIProviderRateLimitError,
    AIProviderResponseError,
    AIProviderTimeoutError,
)
from app.schemas.workflow import ValidationErrorDetail
from app.services.workflow_generation import WorkflowGenerationValidationError
from fastapi.testclient import TestClient


def valid_workflow() -> dict[str, object]:
    return {
        "title": "Lead Qualification Workflow",
        "description": "Qualifies and routes new leads.",
        "nodes": [
            {"id": "start", "type": "start", "title": "Start", "description": "Begin.", "application": None},
            {"id": "end", "type": "end", "title": "End", "description": "Finish.", "application": None},
        ],
        "edges": [{"id": "edge-1", "source": "start", "target": "end", "label": None}],
        "assumptions": [],
        "missingRequirements": [],
        "suggestions": [],
    }


class FakeService:
    def __init__(self, result: dict[str, object] | None = None, error: Exception | None = None) -> None:
        self.result = result or valid_workflow()
        self.error = error
        self.calls: list[str] = []

    async def generate_workflow(self, prompt: str):
        self.calls.append(prompt)
        if self.error is not None:
            raise self.error
        from app.schemas.workflow import Workflow

        return Workflow.model_validate(self.result)


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Iterator[None]:
    yield
    app.dependency_overrides.clear()


def client(*, raise_server_exceptions: bool = True) -> TestClient:
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def use_service(service: FakeService) -> None:
    app.dependency_overrides[get_workflow_generation_service] = lambda: service


def test_valid_request_returns_workflow_and_generation_metadata() -> None:
    service = FakeService()
    use_service(service)

    response = client().post("/api/v1/workflows/generate", json={"prompt": "  Create a workflow.  "})

    assert response.status_code == 200
    body = response.json()
    assert body["workflow"]["title"] == "Lead Qualification Workflow"
    assert body["generation"]["model"] == "openai/gpt-oss-20b"
    assert isinstance(body["generation"]["durationMs"], int)
    assert body["generation"]["durationMs"] >= 0
    assert service.calls == ["Create a workflow."]


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"prompt": ""},
        {"prompt": "   "},
        {"prompt": "x" * 5001},
        {"prompt": 123},
        {"prompt": "valid", "apiKey": "secret"},
    ],
)
def test_invalid_requests_use_safe_envelope_and_do_not_call_service(payload: dict[str, object]) -> None:
    service = FakeService()
    use_service(service)

    response = client().post("/api/v1/workflows/generate", json=payload)

    assert response.status_code == 422
    body = response.json()
    assert body["errors"][0]["code"] == "invalid_request"
    assert body["errors"][0]["field"] in {"prompt", "apiKey"}
    assert "secret" not in response.text
    assert service.calls == []


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (WorkflowGenerationValidationError([ValidationErrorDetail(code="bad", message="bad")]), 502, "invalid_provider_output"),
        (AIProviderConfigurationError("internal provider"), 503, "provider_not_configured"),
        (AIProviderCredentialError("secret-key"), 503, "provider_credentials_unavailable"),
        (AIProviderRateLimitError("headers"), 429, "provider_rate_limited"),
        (AIProviderTimeoutError("httpx details"), 504, "provider_timeout"),
        (AIProviderConnectionError("local path"), 503, "provider_unavailable"),
        (AIProviderAPIError("raw response"), 502, "provider_api_error"),
        (AIProviderResponseError("raw candidate"), 502, "provider_response_invalid"),
    ],
)
def test_known_errors_map_to_safe_responses(error: Exception, status: int, code: str) -> None:
    service = FakeService(error=error)
    use_service(service)

    response = client().post("/api/v1/workflows/generate", json={"prompt": "valid"})

    assert response.status_code == status
    assert response.json()["errors"][0]["code"] == code
    assert all(secret not in response.text for secret in ["secret-key", "raw response", "raw candidate", "httpx details"])


def test_unexpected_errors_are_generic() -> None:
    service = FakeService(error=RuntimeError("private internal detail"))
    use_service(service)

    response = client(raise_server_exceptions=False).post(
        "/api/v1/workflows/generate", json={"prompt": "valid"}
    )

    assert response.status_code == 500
    assert response.json()["errors"][0]["code"] == "internal_error"
    assert "private internal detail" not in response.text
    assert "Traceback" not in response.text


def test_health_endpoint_is_unchanged() -> None:
    response = client().get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
