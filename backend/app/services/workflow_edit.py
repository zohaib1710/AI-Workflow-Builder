from collections.abc import Iterable

from app.domain.validation import WorkflowGraphValidationError, validate_workflow_graph
from app.prompts.workflow_edit import (
    SYSTEM_PROMPT,
    build_edit_correction_prompt,
    build_edit_prompt,
    format_validation_feedback,
)
from app.providers.base import AIProvider
from app.providers.exceptions import AIProviderCredentialError
from app.schemas.workflow import ValidationErrorDetail, Workflow
from app.schemas.workflow_edit import EditWorkflowRequest
from app.services.workflow_candidates import (
    CANDIDATE_VALIDATION_ERRORS,
    feedback_from_candidate_error,
    validate_workflow_candidate,
    validation_details,
)


class WorkflowEditError(ValueError):
    """Base class for safe workflow-edit validation failures."""

    def __init__(
        self,
        message: str,
        errors: Iterable[ValidationErrorDetail],
    ) -> None:
        self.errors = tuple(errors)
        super().__init__(message)


class WorkflowEditInputValidationError(WorkflowEditError):
    """The submitted current workflow is not graph-valid."""

    def __init__(self, errors: Iterable[ValidationErrorDetail]) -> None:
        super().__init__("current workflow is not valid for editing", errors)


class WorkflowEditOutputValidationError(WorkflowEditError):
    """The revised candidate remained invalid after one correction."""

    def __init__(self, errors: Iterable[ValidationErrorDetail]) -> None:
        super().__init__(
            "revised workflow candidate remained invalid after one correction",
            errors,
        )


class WorkflowEditService:
    def __init__(self, provider: AIProvider) -> None:
        self.provider = provider

    async def edit_workflow(
        self,
        instruction: str,
        workflow: Workflow,
    ) -> Workflow:
        request = EditWorkflowRequest(instruction=instruction, workflow=workflow)
        try:
            validate_workflow_graph(request.workflow)
        except WorkflowGraphValidationError as exc:
            raise WorkflowEditInputValidationError(
                validation_details(feedback_from_candidate_error(exc))
            ) from exc

        if not self.provider.is_configured:
            raise AIProviderCredentialError("AI provider credentials are not configured")

        schema = Workflow.model_json_schema(by_alias=True)
        workflow_json = request.workflow.model_dump_json(by_alias=True)
        candidate = await self.provider.generate_structured(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=build_edit_prompt(request.instruction, workflow_json),
            schema=schema,
        )
        try:
            return validate_workflow_candidate(candidate)
        except CANDIDATE_VALIDATION_ERRORS as exc:
            feedback = feedback_from_candidate_error(exc)
            corrected = await self.provider.generate_structured(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=build_edit_correction_prompt(
                    request.instruction,
                    workflow_json,
                    format_validation_feedback(feedback),
                ),
                schema=schema,
            )
            try:
                return validate_workflow_candidate(corrected)
            except CANDIDATE_VALIDATION_ERRORS as final_exc:
                raise WorkflowEditOutputValidationError(
                    validation_details(feedback_from_candidate_error(final_exc))
                ) from final_exc
