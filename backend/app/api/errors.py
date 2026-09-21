from collections.abc import Sequence

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.providers.exceptions import (
    AIProviderAPIError,
    AIProviderConfigurationError,
    AIProviderConnectionError,
    AIProviderCredentialError,
    AIProviderRateLimitError,
    AIProviderResponseError,
    AIProviderTimeoutError,
)
from app.schemas.workflow import ErrorResponse, ValidationErrorDetail
from app.services.workflow_edit import (
    WorkflowEditInputValidationError,
    WorkflowEditOutputValidationError,
)
from app.services.workflow_generation import WorkflowGenerationValidationError


def _response(status_code: int, code: str, message: str, field: str | None = None) -> JSONResponse:
    body = ErrorResponse(
        detail="Workflow generation failed." if status_code != 422 else "Request validation failed.",
        errors=[ValidationErrorDetail(code=code, message=message, field=field)],
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(by_alias=True))


async def request_validation_handler(_: Request, exception: RequestValidationError) -> JSONResponse:
    fields: list[str] = []
    for error in exception.errors():
        location: Sequence[object] = error.get("loc", ())
        field = next((str(part) for part in reversed(location) if part != "body"), "request")
        if field not in fields:
            fields.append(field)
    field = ", ".join(fields) if fields else None
    return _response(422, "invalid_request", "The workflow prompt is invalid.", field)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, request_validation_handler)
    app.add_exception_handler(WorkflowGenerationValidationError, workflow_validation_handler)
    app.add_exception_handler(WorkflowEditInputValidationError, workflow_edit_input_handler)
    app.add_exception_handler(WorkflowEditOutputValidationError, workflow_edit_output_handler)
    app.add_exception_handler(AIProviderConfigurationError, provider_configuration_handler)
    app.add_exception_handler(AIProviderCredentialError, provider_credentials_handler)
    app.add_exception_handler(AIProviderRateLimitError, provider_rate_limit_handler)
    app.add_exception_handler(AIProviderTimeoutError, provider_timeout_handler)
    app.add_exception_handler(AIProviderConnectionError, provider_connection_handler)
    app.add_exception_handler(AIProviderAPIError, provider_api_handler)
    app.add_exception_handler(AIProviderResponseError, provider_response_handler)
    app.add_exception_handler(Exception, internal_error_handler)


async def workflow_validation_handler(_: Request, __: WorkflowGenerationValidationError) -> JSONResponse:
    return _response(502, "invalid_provider_output", "The AI provider returned an invalid workflow.")


async def workflow_edit_input_handler(
    _: Request,
    __: WorkflowEditInputValidationError,
) -> JSONResponse:
    return _response(422, "invalid_edit_workflow", "The submitted workflow is not valid for editing.")


async def workflow_edit_output_handler(
    _: Request,
    __: WorkflowEditOutputValidationError,
) -> JSONResponse:
    return _response(502, "invalid_edit_output", "The AI provider returned an invalid revised workflow.")


async def provider_configuration_handler(_: Request, __: AIProviderConfigurationError) -> JSONResponse:
    return _response(503, "provider_not_configured", "The AI provider is not configured.")


async def provider_credentials_handler(_: Request, __: AIProviderCredentialError) -> JSONResponse:
    return _response(503, "provider_credentials_unavailable", "AI provider credentials are unavailable.")


async def provider_rate_limit_handler(_: Request, __: AIProviderRateLimitError) -> JSONResponse:
    return _response(429, "provider_rate_limited", "The AI provider rate limit was reached.")


async def provider_timeout_handler(_: Request, __: AIProviderTimeoutError) -> JSONResponse:
    return _response(504, "provider_timeout", "The AI provider did not respond in time.")


async def provider_connection_handler(_: Request, __: AIProviderConnectionError) -> JSONResponse:
    return _response(503, "provider_unavailable", "The AI provider is unavailable.")


async def provider_api_handler(_: Request, __: AIProviderAPIError) -> JSONResponse:
    return _response(502, "provider_api_error", "The AI provider request failed.")


async def provider_response_handler(_: Request, __: AIProviderResponseError) -> JSONResponse:
    return _response(502, "provider_response_invalid", "The AI provider returned an invalid response.")


async def internal_error_handler(_: Request, __: Exception) -> JSONResponse:
    return _response(500, "internal_error", "An internal error occurred.")
