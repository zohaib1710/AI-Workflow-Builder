import json
from collections.abc import Iterable

from pydantic import ValidationError

from app.domain.validation import WorkflowGraphValidationError, validate_workflow_graph
from app.schemas.workflow import ValidationErrorDetail, Workflow

type CandidateFeedback = tuple[str, str, str | None]
type CandidateValidationError = (
    json.JSONDecodeError | ValidationError | WorkflowGraphValidationError
)

CANDIDATE_VALIDATION_ERRORS = (
    json.JSONDecodeError,
    ValidationError,
    WorkflowGraphValidationError,
)


def validate_workflow_candidate(candidate: str) -> Workflow:
    """Parse and validate untrusted provider content as a semantic workflow."""
    parsed = json.loads(candidate)
    if not isinstance(parsed, dict):
        raise ValidationError.from_exception_data(
            "Workflow", [{"type": "dict_type", "loc": (), "input": parsed}]
        )
    workflow = Workflow.model_validate(parsed)
    validate_workflow_graph(workflow)
    return workflow


def feedback_from_candidate_error(
    exception: CandidateValidationError,
) -> list[CandidateFeedback]:
    """Return concise feedback without echoing untrusted candidate content."""
    if isinstance(exception, json.JSONDecodeError):
        return [("invalid_json", "Candidate was not valid JSON.", None)]
    if isinstance(exception, WorkflowGraphValidationError):
        return [
            (
                error.code,
                f"Workflow graph rule failed: {error.code.replace('_', ' ')}.",
                error.field,
            )
            for error in exception.errors
        ]

    feedback: list[CandidateFeedback] = []
    for error in exception.errors():
        location = ".".join(str(part) for part in error.get("loc", ())) or "workflow"
        feedback.append(
            (
                "invalid_workflow",
                f"Workflow candidate failed validation at {location}.",
                location,
            )
        )
    return feedback


def validation_details(
    feedback: Iterable[CandidateFeedback],
) -> tuple[ValidationErrorDetail, ...]:
    return tuple(
        ValidationErrorDetail(code=code, message=message, field=field)
        for code, message, field in feedback
    )
