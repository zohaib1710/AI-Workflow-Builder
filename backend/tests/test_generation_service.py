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
from app.services.workflow_generation import (
    WorkflowGenerationService,
    WorkflowGenerationValidationError,
)


def valid_candidate() -> str:
    return json.dumps(
        {
            "title": "Example workflow",
            "description": "A valid workflow.",
            "nodes": [
                {"id": "start", "type": "start", "title": "Start", "description": "Begin.", "application": None},
                {"id": "end", "type": "end", "title": "End", "description": "Finish.", "application": None},
            ],
            "edges": [{"id": "edge-1", "source": "start", "target": "end", "label": None}],
        }
    )


class FakeProvider:
    is_configured = True

    def __init__(self, responses: list[str] | None = None, error: Exception | None = None) -> None:
        self.responses = responses or [valid_candidate()]
        self.error = error
        self.calls: list[dict[str, object]] = []

    async def generate_structured(self, **kwargs: object) -> str:
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.responses.pop(0)


@pytest.mark.asyncio
async def test_valid_candidate_returns_validated_workflow() -> None:
    provider = FakeProvider()
    result = await WorkflowGenerationService(provider).generate_workflow("  Build a workflow.  ")

    assert result.title == "Example workflow"
    assert len(provider.calls) == 1
    assert provider.calls[0]["schema"]["additionalProperties"] is False  # type: ignore[index]
    assert set(provider.calls[0]["schema"]["properties"]) == {  # type: ignore[index]
        "title", "description", "nodes", "edges"
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("first", ["not json", json.dumps({"title": "invalid"})])
async def test_invalid_candidate_then_valid_candidate_retries_once(first: str) -> None:
    provider = FakeProvider([first, valid_candidate()])
    result = await WorkflowGenerationService(provider).generate_workflow("Build a workflow.")

    assert result.title == "Example workflow"
    assert len(provider.calls) == 2
    correction = str(provider.calls[1]["user_prompt"])
    assert "complete corrected workflow" in correction
    assert "patch" in correction.lower()
    assert "not json" not in correction


@pytest.mark.asyncio
async def test_invalid_graph_then_valid_candidate_retries_once() -> None:
    invalid_graph = valid_candidate().replace('"target": "end"', '"target": "missing"')
    provider = FakeProvider([invalid_graph, valid_candidate()])

    result = await WorkflowGenerationService(provider).generate_workflow("Build a workflow.")

    assert result.title == "Example workflow"
    assert len(provider.calls) == 2
    assert "missing_target_node" in str(provider.calls[1]["user_prompt"])


@pytest.mark.asyncio
async def test_invalid_candidate_after_retry_raises_without_third_call() -> None:
    provider = FakeProvider(["not json", "still not json"])

    with pytest.raises(WorkflowGenerationValidationError) as failure:
        await WorkflowGenerationService(provider).generate_workflow("Build a workflow.")
    assert len(provider.calls) == 2
    assert failure.value.errors[0].code == "invalid_json"


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
async def test_provider_errors_are_not_retried(error_type: type[Exception]) -> None:
    provider = FakeProvider(error=error_type("safe provider error"))

    with pytest.raises(error_type):
        await WorkflowGenerationService(provider).generate_workflow("Build a workflow.")
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_missing_configuration_produces_zero_provider_calls() -> None:
    provider = FakeProvider()
    provider.is_configured = False

    with pytest.raises(AIProviderCredentialError):
        await WorkflowGenerationService(provider).generate_workflow("Build a workflow.")
    assert provider.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_candidate",
    [
        lambda: valid_candidate().replace('"start"', '"unsupported"'),
        lambda: valid_candidate().replace('"edge-1"', '"edge-1"\\n"edge-1-duplicate"'),
        lambda: valid_candidate().replace('"end"', '"missing"', 1),
    ],
)
async def test_invalid_workflow_candidates_are_never_returned(invalid_candidate) -> None:
    provider = FakeProvider([invalid_candidate(), invalid_candidate()])

    with pytest.raises(WorkflowGenerationValidationError):
        await WorkflowGenerationService(provider).generate_workflow("Build a workflow.")
    assert len(provider.calls) == 2
