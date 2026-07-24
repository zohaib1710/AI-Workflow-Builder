import pytest
from app.schemas.workflow import (
    GenerateWorkflowRequest,
    GenerationMetadata,
    SupportedNodeType,
    Workflow,
    WorkflowEdge,
    WorkflowNode,
)
from pydantic import ValidationError


def node(node_id: str = "start", node_type: SupportedNodeType = SupportedNodeType.START) -> dict[str, object]:
    return {
        "id": node_id,
        "type": node_type,
        "title": node_id.title(),
        "description": "A workflow step.",
        "application": None,
    }


def edge(edge_id: str = "edge-1", source: str = "start", target: str = "end", label: str | None = None) -> dict[str, object]:
    return {"id": edge_id, "source": source, "target": target, "label": label}


def workflow_payload() -> dict[str, object]:
    return {
        "title": "Example workflow",
        "description": "A valid workflow.",
        "nodes": [node(), node("end", SupportedNodeType.END)],
        "edges": [edge()],
        "assumptions": ["The user has access."],
        "missingRequirements": [],
        "suggestions": ["Add monitoring."],
    }


def test_representative_workflow_parses() -> None:
    workflow = Workflow.model_validate(workflow_payload())
    assert workflow.title == "Example workflow"


def test_supported_node_types_are_exactly_version_one_types() -> None:
    assert {node_type.value for node_type in SupportedNodeType} == {
        "start", "end", "trigger", "action", "decision", "api", "database", "wait", "approval", "notification"
    }


def test_unsupported_node_type_fails() -> None:
    with pytest.raises(ValidationError):
        WorkflowNode.model_validate({**node(), "type": "manual_task"})


@pytest.mark.parametrize(
    ("model", "payload"),
    [
        (Workflow, {**workflow_payload(), "title": "   "}),
        (Workflow, {**workflow_payload(), "description": "   "}),
        (Workflow, {**workflow_payload(), "nodes": []}),
        (WorkflowNode, {**node(), "title": "   "}),
        (WorkflowNode, {**node(), "id": "   "}),
        (WorkflowEdge, {**edge(), "id": "   "}),
        (WorkflowEdge, {**edge(), "source": "   "}),
        (WorkflowEdge, {**edge(), "target": "   "}),
    ],
)
def test_blank_required_fields_fail(model: type[object], payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        model.model_validate(payload)  # type: ignore[attr-defined]


def test_valid_prompt_is_normalized() -> None:
    assert GenerateWorkflowRequest(prompt="  Build a workflow.  ").prompt == "Build a workflow."


@pytest.mark.parametrize("prompt", ["", "   ", "x" * 5001])
def test_invalid_prompt_fails(prompt: str) -> None:
    with pytest.raises(ValidationError):
        GenerateWorkflowRequest(prompt=prompt)


def test_unknown_request_fields_fail() -> None:
    with pytest.raises(ValidationError):
        GenerateWorkflowRequest(prompt="valid", model="not-allowed")


def test_generation_metadata_duration_is_non_negative() -> None:
    assert GenerationMetadata(model="model", durationMs=0).duration_ms == 0
    with pytest.raises(ValidationError):
        GenerationMetadata(model="model", durationMs=-1)


def test_aliases_serialize_as_api_names() -> None:
    workflow = Workflow.model_validate(workflow_payload())
    metadata = GenerationMetadata(model="model", duration_ms=1)
    assert "missingRequirements" in workflow.model_dump(by_alias=True)
    assert "durationMs" in metadata.model_dump(by_alias=True)


@pytest.mark.parametrize(
    ("model", "extra"),
    [
        (WorkflowNode, {"position": {"x": 1, "y": 2}}),
        (WorkflowNode, {"executionStatus": "pending"}),
        (WorkflowNode, {"unknown": True}),
        (WorkflowEdge, {"sourceHandle": "out"}),
        (WorkflowEdge, {"runtimeData": {}}),
        (WorkflowEdge, {"unknown": True}),
        (Workflow, {"workflowId": "wf-1"}),
        (Workflow, {"unknown": True}),
    ],
)
def test_coordinates_execution_and_unknown_fields_are_rejected(model: type[object], extra: dict[str, object]) -> None:
    if model is Workflow:
        payload = {**workflow_payload(), **extra}
    else:
        payload = {**(node() if model is WorkflowNode else edge()), **extra}
    with pytest.raises(ValidationError):
        model.model_validate(payload)  # type: ignore[attr-defined]


def test_decision_edge_label_is_trimmed_but_preserved() -> None:
    parsed = WorkflowEdge.model_validate({**edge(label="  Approved  ")})
    assert parsed.label == "Approved"


def test_whitespace_only_edge_label_fails() -> None:
    with pytest.raises(ValidationError):
        WorkflowEdge.model_validate(edge(label=" "))
