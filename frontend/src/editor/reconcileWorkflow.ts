import type { Workflow, WorkflowNode } from "../types/workflow"
import {
  DEFAULT_SHAPE_BY_NODE_TYPE,
  type CanvasNodePresentation,
  type CanvasPosition,
} from "./types"
import { findNearestClearNodePosition, separateNodePresentations } from "./nodePlacement"

const HORIZONTAL_SPACING = 360

export type WorkflowReconciliationResult =
  | {
      status: "ok"
      presentation: Record<string, CanvasNodePresentation>
    }
  | {
      status: "identity-instability"
    }

function firstRetainedNeighbor(
  candidateIds: Set<string>,
  revisedNodes: WorkflowNode[],
  retainedPresentationIds: Set<string>,
): string | undefined {
  return revisedNodes.find(
    (node) => candidateIds.has(node.id) && retainedPresentationIds.has(node.id),
  )?.id
}

function preferredPosition(
  nodeId: string,
  revisedWorkflow: Workflow,
  retainedPresentationIds: Set<string>,
  presentation: Record<string, CanvasNodePresentation>,
  canvasCenter: CanvasPosition,
): CanvasPosition {
  const predecessorIds = new Set(
    revisedWorkflow.edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => edge.source),
  )
  const predecessorId = firstRetainedNeighbor(
    predecessorIds,
    revisedWorkflow.nodes,
    retainedPresentationIds,
  )
  if (predecessorId !== undefined) {
    const anchor = presentation[predecessorId].position
    return { x: anchor.x + HORIZONTAL_SPACING, y: anchor.y }
  }

  const successorIds = new Set(
    revisedWorkflow.edges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => edge.target),
  )
  const successorId = firstRetainedNeighbor(
    successorIds,
    revisedWorkflow.nodes,
    retainedPresentationIds,
  )
  if (successorId !== undefined) {
    const anchor = presentation[successorId].position
    return { x: anchor.x - HORIZONTAL_SPACING, y: anchor.y }
  }

  return { ...canvasCenter }
}

export function reconcileWorkflowPresentation(
  previousWorkflow: Workflow,
  previousPresentation: Record<string, CanvasNodePresentation>,
  revisedWorkflow: Workflow,
  canvasCenter: CanvasPosition,
): WorkflowReconciliationResult {
  const revisedNodeIds = new Set(revisedWorkflow.nodes.map((node) => node.id))
  const sharedNodeIds = new Set(
    previousWorkflow.nodes
      .filter((node) => revisedNodeIds.has(node.id))
      .map((node) => node.id),
  )

  if (
    previousWorkflow.nodes.length > 0
    && revisedWorkflow.nodes.length > 0
    && sharedNodeIds.size === 0
  ) {
    return { status: "identity-instability" }
  }

  const retainedPresentationIds = new Set(
    [...sharedNodeIds].filter((nodeId) => previousPresentation[nodeId] !== undefined),
  )
  const presentation: Record<string, CanvasNodePresentation> = {}

  for (const node of revisedWorkflow.nodes) {
    if (!retainedPresentationIds.has(node.id)) continue
    const retained = previousPresentation[node.id]
    const copy = {
      nodeId: retained.nodeId,
      shape: retained.shape,
      ...(retained.color ? { color: retained.color } : {}),
      position: { ...retained.position },
    }
    presentation[node.id] = copy
  }

  for (const node of revisedWorkflow.nodes) {
    if (presentation[node.id] !== undefined) continue

    const preferred = preferredPosition(
      node.id,
      revisedWorkflow,
      retainedPresentationIds,
      presentation,
      canvasCenter,
    )
    const shape = DEFAULT_SHAPE_BY_NODE_TYPE[node.type]
    const position = findNearestClearNodePosition(preferred, shape, presentation)

    presentation[node.id] = {
      nodeId: node.id,
      shape,
      position,
    }
  }

  return {
    status: "ok",
    presentation: separateNodePresentations(
      presentation,
      revisedWorkflow.nodes.map((node) => node.id),
    ),
  }
}
