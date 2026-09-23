import pytest
from app.schemas.workflow import GenerationMetadata
from app.schemas.workflow_edit import EditWorkflowRequest, EditWorkflowResponse
from pydantic import ValidationError


def workflow_payload() -> dict[str, object]:
    return {
        "title": "Example workflow",
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
    }


def test_valid_request_has_exact_fields_and_normalizes_instruction() -> None:
    assert len(EditWorkflowRequest(instruction='x' * 2000, workflow=workflow_payload()).instruction) == 2000
    request = EditWorkflowRequest(
        instruction="  Rename the final step.  ",
        workflow=workflow_payload(),
    )

    assert request.instruction == "Rename the final step."
    assert set(request.model_dump()) == {"instruction", "workflow"}


@pytest.mark.parametrize("instruction", ["", "   ", "x" * 2001])
def test_invalid_instruction_is_rejected(instruction: str) -> None:
    with pytest.raises(ValidationError):
        EditWorkflowRequest(instruction=instruction, workflow=workflow_payload())


def test_unknown_request_field_is_rejected() -> None:
    with pytest.raises(ValidationError):
        EditWorkflowRequest(
            instruction="Rename a step.",
            workflow=workflow_payload(),
            model="not-allowed",
        )


def test_response_reuses_canonical_workflow_and_generation_shapes() -> None:
    response = EditWorkflowResponse(
        workflow=workflow_payload(),
        generation=GenerationMetadata(model="model", durationMs=2),
    )
    payload = response.model_dump(by_alias=True)

    assert set(payload) == {"workflow", "generation"}
    assert set(payload["workflow"]) == {"title", "description", "nodes", "edges"}
    assert payload["generation"]["durationMs"] == 2


def test_editor_fields_are_rejected_by_semantic_workflow() -> None:
    payload = workflow_payload()
    payload["annotations"] = [{"id": "note", "text": "Text", "position": {"x": 1, "y": 2}}]

    with pytest.raises(ValidationError):
        EditWorkflowRequest(instruction="Rename a step.", workflow=payload)
