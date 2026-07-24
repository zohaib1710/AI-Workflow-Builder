import json
from collections.abc import Iterable

from pydantic import ValidationError

from app.domain.validation import WorkflowGraphValidationError, validate_workflow_graph
from app.prompts.workflow_generation import (
    SYSTEM_PROMPT,
    build_correction_prompt,
    build_user_prompt,
    format_validation_feedback,
)
from app.providers.base import AIProvider
from app.providers.exceptions import AIProviderCredentialError
from app.schemas.workflow import (
    GenerateWorkflowRequest,
    ValidationErrorDetail,
    Workflow,
)


class WorkflowGenerationValidationError(ValueError):
    """A candidate remained invalid after the single correction attempt."""

    def __init__(self, errors: Iterable[ValidationErrorDetail]) -> None:
        self.errors = tuple(errors)
        super().__init__("workflow candidate remained invalid after one correction")


class WorkflowGenerationService:
    def __init__(self, provider: AIProvider) -> None:
        self.provider = provider

    async def generate_workflow(self, prompt: str) -> Workflow:
        request = GenerateWorkflowRequest(prompt=prompt)
        if not self.provider.is_configured:
            raise AIProviderCredentialError("AI provider credentials are not configured")

        schema = Workflow.model_json_schema(by_alias=True)
        candidate = await self.provider.generate_structured(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=build_user_prompt(request.prompt),
            schema=schema,
        )
        try:
            return self._validate_candidate(candidate)
        except (json.JSONDecodeError, ValidationError, WorkflowGraphValidationError) as exc:
            feedback = self._feedback_from_exception(exc)
            corrected = await self.provider.generate_structured(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=build_correction_prompt(
                    request.prompt,
                    format_validation_feedback(feedback),
                ),
                schema=schema,
            )
            try:
                return self._validate_candidate(corrected)
            except (json.JSONDecodeError, ValidationError, WorkflowGraphValidationError) as final_exc:
                raise WorkflowGenerationValidationError(
                    self._details_from_feedback(self._feedback_from_exception(final_exc))
                ) from final_exc

    @staticmethod
    def _validate_candidate(candidate: str) -> Workflow:
        parsed = json.loads(candidate)
        if not isinstance(parsed, dict):
            raise ValidationError.from_exception_data(
                "Workflow", [{"type": "dict_type", "loc": (), "input": parsed}]
            )
        workflow = Workflow.model_validate(parsed)
        validate_workflow_graph(workflow)
        return workflow

    @staticmethod
    def _feedback_from_exception(
        exception: json.JSONDecodeError | ValidationError | WorkflowGraphValidationError,
    ) -> list[tuple[str, str, str | None]]:
        if isinstance(exception, json.JSONDecodeError):
            return [("invalid_json", "Candidate was not valid JSON.", None)]
        if isinstance(exception, WorkflowGraphValidationError):
            return [(error.code, error.message, error.field) for error in exception.errors]
        feedback: list[tuple[str, str, str | None]] = []
        for error in exception.errors():
            location = ".".join(str(part) for part in error.get("loc", ())) or "workflow"
            feedback.append(("invalid_workflow", f"Workflow candidate failed validation at {location}.", location))
        return feedback

    @staticmethod
    def _details_from_feedback(
        feedback: Iterable[tuple[str, str, str | None]],
    ) -> tuple[ValidationErrorDetail, ...]:
        return tuple(
            ValidationErrorDetail(code=code, message=message, field=field)
            for code, message, field in feedback
        )
