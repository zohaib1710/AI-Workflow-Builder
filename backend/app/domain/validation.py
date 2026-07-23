from collections.abc import Iterable

from app.schemas.workflow import SupportedNodeType, ValidationErrorDetail, Workflow


class WorkflowGraphValidationError(ValueError):
    """Safe, structured graph validation failures."""

    def __init__(self, errors: Iterable[ValidationErrorDetail]) -> None:
        self.errors = tuple(errors)
        super().__init__("workflow graph validation failed")


def _error(code: str, message: str, field: str | None = None) -> ValidationErrorDetail:
    return ValidationErrorDetail(code=code, message=message, field=field)


def validate_workflow_graph(workflow: Workflow) -> None:
    """Validate graph relationships without mutating the workflow."""
    errors: list[ValidationErrorDetail] = []
    node_ids = [node.id for node in workflow.nodes]
    edge_ids = [edge.id for edge in workflow.edges]
    node_id_set = set(node_ids)

    seen_node_ids: set[str] = set()
    reported_node_ids: set[str] = set()
    for node_id in node_ids:
        if node_id in seen_node_ids and node_id not in reported_node_ids:
            errors.append(_error("duplicate_node_id", f"Node ID '{node_id}' is duplicated.", "nodes"))
            reported_node_ids.add(node_id)
        seen_node_ids.add(node_id)

    seen_edge_ids: set[str] = set()
    reported_edge_ids: set[str] = set()
    for edge_id in edge_ids:
        if edge_id in seen_edge_ids and edge_id not in reported_edge_ids:
            errors.append(_error("duplicate_edge_id", f"Edge ID '{edge_id}' is duplicated.", "edges"))
            reported_edge_ids.add(edge_id)
        seen_edge_ids.add(edge_id)

    incoming: dict[str, list[str]] = {node_id: [] for node_id in node_ids}
    outgoing: dict[str, list[str]] = {node_id: [] for node_id in node_ids}
    valid_edges: list[tuple[str, str, str]] = []
    for edge in workflow.edges:
        source_exists = edge.source in node_id_set
        target_exists = edge.target in node_id_set
        if not source_exists:
            errors.append(
                _error("missing_source_node", f"Source node '{edge.source}' does not exist.", "edges")
            )
        if not target_exists:
            errors.append(
                _error("missing_target_node", f"Target node '{edge.target}' does not exist.", "edges")
            )
        if edge.source == edge.target:
            errors.append(
                _error("self_referencing_edge", f"Edge '{edge.id}' references the same node on both sides.", "edges")
            )
        if source_exists:
            outgoing[edge.source].append(edge.id)
        if target_exists:
            incoming[edge.target].append(edge.id)
        if source_exists and target_exists:
            valid_edges.append((edge.id, edge.source, edge.target))

    nodes_by_id = {node.id: node for node in workflow.nodes}
    for node in workflow.nodes:
        if node.type is SupportedNodeType.START and incoming[node.id]:
            errors.append(
                _error("start_node_has_incoming_edge", f"Start node '{node.id}' must not have incoming edges.", "nodes")
            )
        if node.type is SupportedNodeType.END and outgoing[node.id]:
            errors.append(
                _error("end_node_has_outgoing_edge", f"End node '{node.id}' must not have outgoing edges.", "nodes")
            )
        if node.type is SupportedNodeType.DECISION:
            decision_edges = [edge for edge in workflow.edges if edge.source == node.id]
            if len(decision_edges) < 2:
                errors.append(
                    _error(
                        "decision_requires_multiple_paths",
                        f"Decision node '{node.id}' must have at least two outgoing edges.",
                        "nodes",
                    )
                )
            for edge in decision_edges:
                if edge.label is None or not edge.label.strip():
                    errors.append(
                        _error(
                            "decision_edge_label_required",
                            f"Decision edge '{edge.id}' must have a meaningful label.",
                            "edges",
                        )
                    )

    if len(workflow.nodes) > 1:
        adjacency: dict[str, set[str]] = {node_id: set() for node_id in node_ids}
        for _, source, target in valid_edges:
            adjacency[source].add(target)
            adjacency[target].add(source)
        start_id = node_ids[0]
        connected = {start_id}
        pending = [start_id]
        while pending:
            current = pending.pop(0)
            for neighbor in node_ids:
                if neighbor in adjacency[current] and neighbor not in connected:
                    connected.add(neighbor)
                    pending.append(neighbor)
        disconnected = [node_id for node_id in node_ids if node_id not in connected]
        if disconnected:
            errors.append(
                _error(
                    "disconnected_graph",
                    f"Workflow contains disconnected nodes: {', '.join(disconnected)}.",
                    "nodes",
                )
            )

    if errors:
        raise WorkflowGraphValidationError(errors)
