import type { Workflow } from "../types/workflow"
import type { EditorValidationIssue } from "./types"

export function validateWorkflowDraft(workflow: Readonly<Workflow>): EditorValidationIssue[] {
  const issues: EditorValidationIssue[] = []
  const nodeIds = workflow.nodes.map((node) => node.id)
  const nodeIdSet = new Set(nodeIds)

  const seenNodeIds = new Set<string>()
  const reportedNodeIds = new Set<string>()
  for (const node of workflow.nodes) {
    if (seenNodeIds.has(node.id) && !reportedNodeIds.has(node.id)) {
      issues.push({ code: "duplicate_node_id", message: `Node ID '${node.id}' is duplicated.`, nodeId: node.id })
      reportedNodeIds.add(node.id)
    }
    seenNodeIds.add(node.id)
  }

  const seenEdgeIds = new Set<string>()
  const reportedEdgeIds = new Set<string>()
  for (const edge of workflow.edges) {
    if (seenEdgeIds.has(edge.id) && !reportedEdgeIds.has(edge.id)) {
      issues.push({ code: "duplicate_edge_id", message: `Edge ID '${edge.id}' is duplicated.`, edgeId: edge.id })
      reportedEdgeIds.add(edge.id)
    }
    seenEdgeIds.add(edge.id)
  }

  const incoming = new Map(nodeIds.map((nodeId) => [nodeId, [] as string[]]))
  const outgoing = new Map(nodeIds.map((nodeId) => [nodeId, [] as string[]]))
  const validEdges: Array<readonly [string, string]> = []
  for (const edge of workflow.edges) {
    const sourceExists = nodeIdSet.has(edge.source)
    const targetExists = nodeIdSet.has(edge.target)
    if (!sourceExists) issues.push({ code: "missing_source_node", message: `Source node '${edge.source}' does not exist.`, edgeId: edge.id })
    if (!targetExists) issues.push({ code: "missing_target_node", message: `Target node '${edge.target}' does not exist.`, edgeId: edge.id })
    if (edge.source === edge.target) issues.push({ code: "self_referencing_edge", message: `Edge '${edge.id}' references the same node on both sides.`, edgeId: edge.id })
    if (sourceExists) outgoing.get(edge.source)?.push(edge.id)
    if (targetExists) incoming.get(edge.target)?.push(edge.id)
    if (sourceExists && targetExists) validEdges.push([edge.source, edge.target])
  }

  for (const node of workflow.nodes) {
    if (node.type === "start" && (incoming.get(node.id)?.length ?? 0) > 0) {
      issues.push({ code: "start_node_has_incoming_edge", message: `Start node '${node.id}' must not have incoming edges.`, nodeId: node.id })
    }
    if (node.type === "end" && (outgoing.get(node.id)?.length ?? 0) > 0) {
      issues.push({ code: "end_node_has_outgoing_edge", message: `End node '${node.id}' must not have outgoing edges.`, nodeId: node.id })
    }
  }

  for (const node of workflow.nodes) {
    if (node.type !== "decision") continue
    const decisionEdges = workflow.edges.filter((edge) => edge.source === node.id)
    if (decisionEdges.length < 2) {
      issues.push({ code: "decision_requires_multiple_paths", message: `Decision node '${node.id}' must have at least two outgoing edges.`, nodeId: node.id })
    }
    for (const edge of decisionEdges) {
      if (edge.label === null || !edge.label.trim()) {
        issues.push({ code: "decision_edge_label_required", message: `Decision edge '${edge.id}' must have a meaningful label.`, edgeId: edge.id })
      }
    }
  }

  if (workflow.nodes.length > 1) {
    const adjacency = new Map(nodeIds.map((nodeId) => [nodeId, new Set<string>()]))
    for (const [source, target] of validEdges) {
      adjacency.get(source)?.add(target)
      adjacency.get(target)?.add(source)
    }
    const connected = new Set<string>([nodeIds[0]])
    const pending = [nodeIds[0]]
    while (pending.length > 0) {
      const current = pending.shift()
      if (current === undefined) break
      for (const neighbor of nodeIds) {
        if (adjacency.get(current)?.has(neighbor) && !connected.has(neighbor)) {
          connected.add(neighbor)
          pending.push(neighbor)
        }
      }
    }
    const disconnected = nodeIds.filter((nodeId) => !connected.has(nodeId))
    if (disconnected.length > 0) {
      issues.push({ code: "disconnected_graph", message: `Workflow contains disconnected nodes: ${disconnected.join(", ")}.` })
    }
  }
  return issues
}
