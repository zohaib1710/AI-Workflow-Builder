import json

import pytest
from app.providers.exceptions import (
    AIProviderAPIError,
    AIProviderConfigurationError,
    AIProviderConnectionError,
    AIProviderCredentialError,
    AIProviderRateLimitError,
    AIProviderResponseError,
    AIProviderTimeoutError,
)
from app.schemas.workflow import Workflow
from app.services.workflow_edit import (
    WorkflowEditInputValidationError,
    WorkflowEditOutputValidationError,
    WorkflowEditService,
)

SECRET_SENTINEL = "SUPER_SECRET_TEST_VALUE"


def workflow_payload(*, title: str = "Current workflow") -> dict[str, object]:
    return {
        "title": title,
        "description": "A valid workflow.",
        "nodes": [
            {
                "id": "start",
                "type": "start",
                "title": "Start",
                "description": "Begin.",
                "application": None,
            },
            {
                "id": "end",
                "type": "end",
                "title": "End",
                "description": "Finish.",
                "application": None,
            },
        ],
        "edges": [
            {
                "id": "edge-1",
                "source": "start",
                "target": "end",
                "label": None,
            }
        ],
        "assumptions": ["Access exists."],
        "missingRequirements": ["Confirm owner."],
        "suggestions": ["Add monitoring."],
    }


def workflow(*, title: str = "Current workflow") -> Workflow:
    return Workflow.model_validate(workflow_payload(title=title))


def valid_candidate() -> str:
    return json.dumps(workflow_payload(title="Revised workflow"))


def graph_invalid_candidate() -> str:
    payload = workflow_payload(title="Invalid revision")
    edges = payload["edges"]
    assert isinstance(edges, list)
    edges[0]["target"] = "missing"
    return json.dumps(payload)


class FakeProvider:
    is_configured = True

    def __init__(
        self,
        responses: list[str] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.responses = responses or [valid_candidate()]
        self.error = error
        self.calls: list[dict[str, object]] = []

    async def generate_structured(self, **kwargs: object) -> str:
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.responses.pop(0)


@pytest.mark.asyncio
async def test_valid_edit_returns_complete_revised_workflow_with_stable_id_prompt() -> None:
    provider = FakeProvider()

    result = await WorkflowEditService(provider).edit_workflow(
        "  Rename the workflow.  ",
        workflow(),
    )

    assert result.title == "Revised workflow"
    assert len(provider.calls) == 1
    prompts = (
        f"{provider.calls[0]['system_prompt']}\n"
        f"{provider.calls[0]['user_prompt']}"
    )
    assert "Rename the workflow." in prompts
    assert "complete revised workflow" in prompts.lower()
    assert "same logical step" in prompts
    assert "unique ID" in prompts
    assert '"missingRequirements"' in prompts
    assert '"missing_requirements"' not in prompts


@pytest.mark.asyncio
async def test_invalid_current_graph_fails_before_provider_call() -> None:
    payload = workflow_payload()
    edges = payload["edges"]
    assert isinstance(edges, list)
    edges[0]["target"] = "missing"
    provider = FakeProvider()

    with pytest.raises(WorkflowEditInputValidationError):
        await WorkflowEditService(provider).edit_workflow(
            "Rename the workflow.",
            Workflow.model_validate(payload),
        )

    assert provider.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "first_candidate",
    [
        "not json",
        json.dumps({"title": "invalid"}),
        graph_invalid_candidate(),
    ],
    ids=["invalid-json", "schema-invalid", "graph-invalid"],
)
async def test_invalid_candidate_is_corrected_once(first_candidate: str) -> None:
    provider = FakeProvider([first_candidate, valid_candidate()])

    result = await WorkflowEditService(provider).edit_workflow(
        "Rename the workflow.",
        workflow(),
    )

    assert result.title == "Revised workflow"
    assert len(provider.calls) == 2
    correction = str(provider.calls[1]["user_prompt"])
    assert "complete corrected revised workflow" in correction
    assert "not a patch" in correction
    assert first_candidate not in correction


@pytest.mark.asyncio
async def test_invalid_twice_stops_safely_after_two_calls() -> None:
    provider = FakeProvider([SECRET_SENTINEL, SECRET_SENTINEL])

    with pytest.raises(WorkflowEditOutputValidationError) as failure:
        await WorkflowEditService(provider).edit_workflow(
            "Rename the workflow.",
            workflow(),
        )

    assert len(provider.calls) == 2
    assert SECRET_SENTINEL not in str(failure.value)
    assert SECRET_SENTINEL not in str(failure.value.errors)
    assert SECRET_SENTINEL not in str(provider.calls[1]["user_prompt"])


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error_type",
    [
        AIProviderConfigurationError,
        AIProviderCredentialError,
        AIProviderRateLimitError,
        AIProviderTimeoutError,
        AIProviderConnectionError,
        AIProviderAPIError,
        AIProviderResponseError,
    ],
)
async def test_provider_failures_pass_through_without_retry(
    error_type: type[Exception],
) -> None:
    provider = FakeProvider(error=error_type("safe provider error"))

    with pytest.raises(error_type):
        await WorkflowEditService(provider).edit_workflow(
            "Rename the workflow.",
            workflow(),
        )

    assert len(provider.calls) == 1
