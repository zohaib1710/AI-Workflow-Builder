import pytest

from app.domain.validation import WorkflowGraphValidationError, validate_workflow_graph
from app.schemas.workflow import SupportedNodeType, Workflow
from tests.test_workflow_schemas import edge, node, workflow_payload


def make_workflow(nodes: list[dict[str, object]], edges: list[dict[str, object]]) -> Workflow:
    payload = {**workflow_payload(), "nodes": nodes, "edges": edges}
    return Workflow.model_validate(payload)


def error_codes(workflow: Workflow) -> list[str]:
    with pytest.raises(WorkflowGraphValidationError) as failure:
        validate_workflow_graph(workflow)
    return [error.code for error in failure.value.errors]


def test_valid_linear_workflow_passes() -> None:
    validate_workflow_graph(make_workflow([node(), node("end", SupportedNodeType.END)], [edge()]))


def test_valid_decision_workflow_with_labels_passes() -> None:
    nodes = [node(), node("decision", SupportedNodeType.DECISION), node("yes", SupportedNodeType.END), node("no", SupportedNodeType.END)]
    edges = [
        edge("e1", "start", "decision"),
        edge("e2", "decision", "yes", "Yes"),
        edge("e3", "decision", "no", "No"),
    ]
    validate_workflow_graph(make_workflow(nodes, edges))


def test_valid_single_node_workflow_passes() -> None:
    validate_workflow_graph(make_workflow([node()], []))


@pytest.mark.parametrize(
    ("nodes", "edges", "expected"),
    [
        ([node(), node("start")], [edge()], "duplicate_node_id"),
        ([node(), node("end", SupportedNodeType.END)], [edge(), edge()], "duplicate_edge_id"),
        ([node(), node("end", SupportedNodeType.END)], [edge(source="missing")], "missing_source_node"),
        ([node(), node("end", SupportedNodeType.END)], [edge(target="missing")], "missing_target_node"),
        ([node()], [edge(source="start", target="start")], "self_referencing_edge"),
        ([node(), node("end", SupportedNodeType.END)], [edge(source="end", target="start")], "start_node_has_incoming_edge"),
        ([node(), node("end", SupportedNodeType.END)], [edge(source="start", target="end"), edge("e2", "end", "start")], "end_node_has_outgoing_edge"),
    ],
)
def test_basic_graph_rules_fail(nodes: list[dict[str, object]], edges: list[dict[str, object]], expected: str) -> None:
    workflow = make_workflow(nodes, edges)
    assert expected in error_codes(workflow)


def test_decision_requires_two_labelled_paths() -> None:
    nodes = [node("decision", SupportedNodeType.DECISION), node("end", SupportedNodeType.END)]
    workflow = make_workflow(nodes, [edge("e1", "decision", "end", "Yes")])
    codes = error_codes(workflow)
    assert "decision_requires_multiple_paths" in codes


def test_disconnected_graph_fails() -> None:
    nodes = [node(), node("end", SupportedNodeType.END), node("isolated", SupportedNodeType.ACTION)]
    workflow = make_workflow(nodes, [edge()])
    assert "disconnected_graph" in error_codes(workflow)


def test_two_disconnected_sections_fail() -> None:
    nodes = [node(), node("end", SupportedNodeType.END), node("other", SupportedNodeType.ACTION), node("other-end", SupportedNodeType.END)]
    workflow = make_workflow(nodes, [edge(), edge("e2", "other", "other-end")])
    assert "disconnected_graph" in error_codes(workflow)


def test_error_codes_are_safe_and_deterministic() -> None:
    nodes = [node(), node("end", SupportedNodeType.END), node("isolated", SupportedNodeType.ACTION)]
    workflow = make_workflow(nodes, [edge()])
    first = error_codes(workflow)
    second = error_codes(workflow)
    assert first == second
    assert all(code.replace("_", "").isalnum() for code in first)


def test_validation_does_not_mutate_workflow() -> None:
    workflow = make_workflow([node(), node("end", SupportedNodeType.END)], [edge()])
    before = workflow.model_dump()
    validate_workflow_graph(workflow)
    assert workflow.model_dump() == before


def test_unsupported_node_type_fails_before_graph_validation() -> None:
    with pytest.raises(Exception):
        Workflow.model_validate({**workflow_payload(), "nodes": [{**node(), "type": "unsupported"}]})
