import { layoutWorkflow } from "../lib/layout"
import type { Workflow } from "../types/workflow"
import { DEFAULT_SHAPE_BY_NODE_TYPE, type CanvasNodePresentation } from "./types"

export type NodePresentationMap = Record<string, CanvasNodePresentation>

export function createInitialPresentation(workflow: Workflow): NodePresentationMap {
  const positions = new Map(layoutWorkflow(workflow).nodes.map((node) => [node.id, node.position] as const))
  return Object.fromEntries(workflow.nodes.map((node) => {
    const position = positions.get(node.id)
    if (position === undefined) throw new Error("Layout did not return a position for a workflow node.")
    return [node.id, { nodeId: node.id, shape: DEFAULT_SHAPE_BY_NODE_TYPE[node.type], position: { ...position } }]
  }))
}

export function autoArrangePresentation(
  workflow: Workflow,
  currentPresentation: NodePresentationMap,
): NodePresentationMap {
  if (workflow.nodes.length === 0) return currentPresentation

  const nodeIds = new Set(workflow.nodes.map((node) => node.id))
  const layoutWorkflowInput: Workflow = {
    ...workflow,
    edges: workflow.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    ),
  }
  const positions = new Map(
    layoutWorkflow(layoutWorkflowInput).nodes.map((node) => [node.id, node.position] as const),
  )
  const arranged = { ...currentPresentation }
  let changed = false

  for (const node of workflow.nodes) {
    const position = positions.get(node.id)
    if (!position) continue
    const current = currentPresentation[node.id]
    if (
      current
      && current.position.x === position.x
      && current.position.y === position.y
    ) {
      continue
    }
    arranged[node.id] = {
      nodeId: node.id,
      shape: current?.shape ?? DEFAULT_SHAPE_BY_NODE_TYPE[node.type],
      position: { ...position },
    }
    changed = true
  }

  return changed ? arranged : currentPresentation
}
