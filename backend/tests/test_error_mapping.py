import json

import pytest
from app.api.errors import (
    internal_error_handler,
    provider_api_handler,
    provider_configuration_handler,
    provider_connection_handler,
    provider_credentials_handler,
    provider_rate_limit_handler,
    provider_response_handler,
    provider_timeout_handler,
    workflow_edit_input_handler,
    workflow_edit_output_handler,
    workflow_validation_handler,
)
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
from app.services.workflow_edit import (
    WorkflowEditInputValidationError,
    WorkflowEditOutputValidationError,
)
from app.services.workflow_generation import WorkflowGenerationValidationError
from starlette.requests import Request


def request() -> Request:
    return Request({"type": "http", "method": "POST", "path": "/test", "headers": []})


def response_body(response) -> dict[str, object]:
    return json.loads(response.body)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("handler", "error", "expected_status", "expected_code"),
    [
        (
            workflow_validation_handler,
            WorkflowGenerationValidationError(
                [ValidationErrorDetail(code="invalid_json", message="Candidate was invalid.")]
            ),
            502,
            "invalid_provider_output",
        ),
        (
            workflow_edit_input_handler,
            WorkflowEditInputValidationError(
                [ValidationErrorDetail(code="disconnected_graph", message="private graph detail")]
            ),
            422,
            "invalid_edit_workflow",
        ),
        (
            workflow_edit_output_handler,
            WorkflowEditOutputValidationError(
                [ValidationErrorDetail(code="invalid_json", message="private candidate detail")]
            ),
            502,
            "invalid_edit_output",
        ),
        (
            provider_configuration_handler,
            AIProviderConfigurationError("private configuration detail"),
            503,
            "provider_not_configured",
        ),
        (
            provider_credentials_handler,
            AIProviderCredentialError("private credential detail"),
            503,
            "provider_credentials_unavailable",
        ),
        (
            provider_rate_limit_handler,
            AIProviderRateLimitError("private rate detail"),
            429,
            "provider_rate_limited",
        ),
        (
            provider_timeout_handler,
            AIProviderTimeoutError("private timeout detail"),
            504,
            "provider_timeout",
        ),
        (
            provider_connection_handler,
            AIProviderConnectionError("private connection detail"),
            503,
            "provider_unavailable",
        ),
        (
            provider_api_handler,
            AIProviderAPIError("private API detail"),
            502,
            "provider_api_error",
        ),
        (
            provider_response_handler,
            AIProviderResponseError("private response detail"),
            502,
            "provider_response_invalid",
        ),
    ],
)
async def test_known_exceptions_map_to_stable_safe_responses(
    handler,
    error: Exception,
    expected_status: int,
    expected_code: str,
) -> None:
    response = await handler(request(), error)
    body = response_body(response)

    assert response.status_code == expected_status
    expected_detail = (
        "Request validation failed."
        if expected_status == 422
        else "Workflow generation failed."
    )
    assert body["detail"] == expected_detail
    assert body["errors"][0]["code"] == expected_code  # type: ignore[index]
    assert str(error) not in response.body.decode()


@pytest.mark.asyncio
async def test_unexpected_exception_maps_to_internal_error() -> None:
    error = RuntimeError("private internal detail")

    response = await internal_error_handler(request(), error)
    body = response_body(response)

    assert response.status_code == 500
    assert body["errors"][0]["code"] == "internal_error"  # type: ignore[index]
    assert str(error) not in response.body.decode()
    assert "Traceback" not in response.body.decode()


@pytest.mark.asyncio
async def test_provider_failure_does_not_leak_secret_sentinel() -> None:
    sentinel = "SUPER_SECRET_TEST_VALUE"
    error = AIProviderAPIError(sentinel)

    response = await provider_api_handler(request(), error)
    body = response_body(response)

    assert sentinel not in response.body.decode()
    assert sentinel not in body["errors"][0]["message"]  # type: ignore[index]
