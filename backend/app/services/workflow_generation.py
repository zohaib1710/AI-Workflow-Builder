from collections.abc import Iterable

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
from app.services.workflow_candidates import (
    CANDIDATE_VALIDATION_ERRORS,
    feedback_from_candidate_error,
    validate_workflow_candidate,
    validation_details,
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
            return validate_workflow_candidate(candidate)
        except CANDIDATE_VALIDATION_ERRORS as exc:
            feedback = feedback_from_candidate_error(exc)
            corrected = await self.provider.generate_structured(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=build_correction_prompt(
                    request.prompt,
                    format_validation_feedback(feedback),
                ),
                schema=schema,
            )
            try:
                return validate_workflow_candidate(corrected)
            except CANDIDATE_VALIDATION_ERRORS as final_exc:
                raise WorkflowGenerationValidationError(
                    validation_details(feedback_from_candidate_error(final_exc))
                ) from final_exc
