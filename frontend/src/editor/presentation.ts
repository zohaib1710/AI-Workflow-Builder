import { layoutWorkflow } from "../lib/layout"
import type { Workflow } from "../types/workflow"
import { DEFAULT_SHAPE_BY_NODE_TYPE, type CanvasNodePresentation } from "./types"

export function createInitialPresentation(workflow: Workflow): Record<string, CanvasNodePresentation> {
  const positions = new Map(layoutWorkflow(workflow).nodes.map((node) => [node.id, node.position] as const))
  return Object.fromEntries(workflow.nodes.map((node) => {
    const position = positions.get(node.id)
    if (position === undefined) throw new Error("Layout did not return a position for a workflow node.")
    return [node.id, { nodeId: node.id, shape: DEFAULT_SHAPE_BY_NODE_TYPE[node.type], position: { ...position } }]
  }))
}
