import type { Workflow, WorkflowEdge, WorkflowNode } from "../types/workflow"
import { createInitialPresentation } from "./presentation"
import { NODE_CREATION_PRESETS_BY_ID, type CanvasAnnotation, type CanvasPosition, type EditorAsyncState, type EditorSelection, type EditorSnapshot, type EditorState, type EditorTool, type EditorValidationIssue, type FlowchartShape, type NodeCreationPresetId } from "./types"
import { validateWorkflowDraft } from "./validation"

export const EDITOR_HISTORY_LIMIT = 100

type EditableNodeFields = Partial<Pick<WorkflowNode, "title" | "description" | "application">>

export type RecordedEditorAction =
  | { type: "snapshot/record"; snapshot: EditorSnapshot }
  | { type: "node/position-commit"; nodeId: string; position: CanvasPosition }
  | { type: "node/semantic-commit"; nodeId: string; fields: EditableNodeFields }
  | { type: "node/shape-commit"; nodeId: string; shape: FlowchartShape }
  | { type: "node/create"; nodeId: string; presetId: NodeCreationPresetId; position: CanvasPosition }
  | { type: "node/delete"; nodeId: string }
  | { type: "edge/create"; edge: WorkflowEdge }
  | { type: "edge/label-commit"; edgeId: string; label: string | null }
  | { type: "edge/delete"; edgeId: string }
  | { type: "annotation/create"; annotation: CanvasAnnotation }
  | { type: "annotation/text-commit"; annotationId: string; text: string }
  | { type: "annotation/position-commit"; annotationId: string; position: CanvasPosition }
  | { type: "annotation/delete"; annotationId: string }
export type SkippedEditorAction =
  | { type: "selection/set"; selection: EditorSelection }
  | { type: "tool/set"; tool: EditorTool }
  | { type: "node-preset/set"; presetId: NodeCreationPresetId }
  | { type: "async/set"; asyncState: EditorAsyncState }
  | { type: "issues/set"; issues: EditorValidationIssue[] }
export type EditorAction = RecordedEditorAction | SkippedEditorAction | { type: "history/undo" } | { type: "history/redo" }

export function createEditorSnapshot(workflow: Workflow): EditorSnapshot {
  return { workflow, nodePresentations: createInitialPresentation(workflow), annotations: [] }
}

export function createInitialEditorState(workflow: Workflow): EditorState {
  return {
    past: [], future: [], present: createEditorSnapshot(workflow),
    selection: { kind: "none" }, activeTool: "select", pendingNodePreset: null, asyncState: { status: "idle" },
    issues: validateWorkflowDraft(workflow),
  }
}

function recordSnapshot(state: EditorState, snapshot: EditorSnapshot): EditorState {
  return {
    ...state,
    past: [...state.past, state.present].slice(-EDITOR_HISTORY_LIMIT),
    present: snapshot,
    future: [],
    issues: validateWorkflowDraft(snapshot.workflow),
  }
}

function selectionExists(selection: EditorSelection, snapshot: EditorSnapshot): boolean {
  if (selection.kind === "none") return true
  if (selection.kind === "node") return snapshot.workflow.nodes.some((node) => node.id === selection.nodeId)
  if (selection.kind === "edge") return snapshot.workflow.edges.some((edge) => edge.id === selection.edgeId)
  return snapshot.annotations.some((annotation) => annotation.id === selection.annotationId)
}

function selectionForSnapshot(selection: EditorSelection, snapshot: EditorSnapshot): EditorSelection {
  return selectionExists(selection, snapshot) ? selection : { kind: "none" }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "snapshot/record":
      return action.snapshot === state.present ? state : recordSnapshot(state, action.snapshot)
    case "node/position-commit": {
      const presentation = state.present.nodePresentations[action.nodeId]
      if (!presentation || (presentation.position.x === action.position.x && presentation.position.y === action.position.y)) return state
      return recordSnapshot(state, {
        ...state.present,
        nodePresentations: {
          ...state.present.nodePresentations,
          [action.nodeId]: { ...presentation, position: { ...action.position } },
        },
      })
    }
    case "node/semantic-commit": {
      const nodeIndex = state.present.workflow.nodes.findIndex((node) => node.id === action.nodeId)
      if (nodeIndex === -1) return state
      const currentNode = state.present.workflow.nodes[nodeIndex]
      const nextNode = { ...currentNode, ...action.fields }
      if (nextNode.title === currentNode.title && nextNode.description === currentNode.description && nextNode.application === currentNode.application) return state
      const nodes = [...state.present.workflow.nodes]
      nodes[nodeIndex] = nextNode
      return recordSnapshot(state, {
        ...state.present,
        workflow: { ...state.present.workflow, nodes },
      })
    }
    case "node/shape-commit": {
      const presentation = state.present.nodePresentations[action.nodeId]
      if (!presentation || presentation.shape === action.shape) return state
      return recordSnapshot(state, {
        ...state.present,
        nodePresentations: {
          ...state.present.nodePresentations,
          [action.nodeId]: { ...presentation, shape: action.shape },
        },
      })
    }
    case "node/create": {
      if (state.present.workflow.nodes.some((node) => node.id === action.nodeId)) return state
      const preset = NODE_CREATION_PRESETS_BY_ID[action.presetId]
      const recorded = recordSnapshot(state, {
        ...state.present,
        workflow: {
          ...state.present.workflow,
          nodes: [...state.present.workflow.nodes, {
            id: action.nodeId,
            type: preset.semanticType,
            title: "New step",
            description: "Describe this step.",
            application: null,
          }],
        },
        nodePresentations: {
          ...state.present.nodePresentations,
          [action.nodeId]: {
            nodeId: action.nodeId,
            shape: preset.shape,
            position: { ...action.position },
          },
        },
      })
      return {
        ...recorded,
        selection: { kind: "node", nodeId: action.nodeId },
        activeTool: "select",
        pendingNodePreset: null,
      }
    }
    case "node/delete": {
      if (!state.present.workflow.nodes.some((node) => node.id === action.nodeId)) return state
      const nodePresentations = Object.fromEntries(
        Object.entries(state.present.nodePresentations).filter(([nodeId]) => nodeId !== action.nodeId),
      )
      const recorded = recordSnapshot(state, {
        ...state.present,
        workflow: {
          ...state.present.workflow,
          nodes: state.present.workflow.nodes.filter((node) => node.id !== action.nodeId),
          edges: state.present.workflow.edges.filter((edge) => edge.source !== action.nodeId && edge.target !== action.nodeId),
        },
        nodePresentations,
      })
      return { ...recorded, selection: { kind: "none" } }
    }
    case "edge/create": {
      const { edge } = action
      if (
        !edge.id
        || state.present.workflow.edges.some((candidate) => candidate.id === edge.id)
        || edge.source === edge.target
        || !state.present.workflow.nodes.some((node) => node.id === edge.source)
        || !state.present.workflow.nodes.some((node) => node.id === edge.target)
      ) return state
      const sourceNode = state.present.workflow.nodes.find((node) => node.id === edge.source)
      const label = edge.label?.trim() || null
      if (sourceNode?.type === "decision" && label === null) return state
      const recorded = recordSnapshot(state, {
        ...state.present,
        workflow: {
          ...state.present.workflow,
          edges: [...state.present.workflow.edges, { ...edge, label }],
        },
      })
      return { ...recorded, selection: { kind: "edge", edgeId: edge.id } }
    }
    case "edge/label-commit": {
      const edgeIndex = state.present.workflow.edges.findIndex((edge) => edge.id === action.edgeId)
      if (edgeIndex === -1) return state
      const normalizedLabel = action.label?.trim() || null
      const currentEdge = state.present.workflow.edges[edgeIndex]
      if (currentEdge.label === normalizedLabel) return state
      const edges = [...state.present.workflow.edges]
      edges[edgeIndex] = { ...currentEdge, label: normalizedLabel }
      return recordSnapshot(state, {
        ...state.present,
        workflow: { ...state.present.workflow, edges },
      })
    }
    case "edge/delete": {
      if (!state.present.workflow.edges.some((edge) => edge.id === action.edgeId)) return state
      const recorded = recordSnapshot(state, {
        ...state.present,
        workflow: {
          ...state.present.workflow,
          edges: state.present.workflow.edges.filter((edge) => edge.id !== action.edgeId),
        },
      })
      return { ...recorded, selection: { kind: "none" } }
    }
    case "annotation/create": {
      if (state.present.annotations.some((annotation) => annotation.id === action.annotation.id)) return state
      const annotation = {
        ...action.annotation,
        text: action.annotation.text.trim() || "Text",
        position: { ...action.annotation.position },
      }
      const recorded = recordSnapshot(state, {
        ...state.present,
        annotations: [...state.present.annotations, annotation],
      })
      return {
        ...recorded,
        selection: { kind: "annotation", annotationId: annotation.id },
        activeTool: "select",
        pendingNodePreset: null,
      }
    }
    case "annotation/text-commit": {
      const annotationIndex = state.present.annotations.findIndex((annotation) => annotation.id === action.annotationId)
      if (annotationIndex === -1) return state
      const text = action.text.trim() || "Text"
      const currentAnnotation = state.present.annotations[annotationIndex]
      if (currentAnnotation.text === text) return state
      const annotations = [...state.present.annotations]
      annotations[annotationIndex] = { ...currentAnnotation, text }
      return recordSnapshot(state, { ...state.present, annotations })
    }
    case "annotation/position-commit": {
      const annotationIndex = state.present.annotations.findIndex((annotation) => annotation.id === action.annotationId)
      if (annotationIndex === -1) return state
      const currentAnnotation = state.present.annotations[annotationIndex]
      if (
        currentAnnotation.position.x === action.position.x
        && currentAnnotation.position.y === action.position.y
      ) return state
      const annotations = [...state.present.annotations]
      annotations[annotationIndex] = { ...currentAnnotation, position: { ...action.position } }
      return recordSnapshot(state, { ...state.present, annotations })
    }
    case "annotation/delete": {
      if (!state.present.annotations.some((annotation) => annotation.id === action.annotationId)) return state
      const recorded = recordSnapshot(state, {
        ...state.present,
        annotations: state.present.annotations.filter((annotation) => annotation.id !== action.annotationId),
      })
      return { ...recorded, selection: { kind: "none" } }
    }
    case "history/undo": {
      const previous = state.past.at(-1)
      if (previous === undefined) return state
      return { ...state, past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], selection: selectionForSnapshot(state.selection, previous), issues: validateWorkflowDraft(previous.workflow) }
    }
    case "history/redo": {
      const next = state.future[0]
      if (next === undefined) return state
      return { ...state, past: [...state.past, state.present].slice(-EDITOR_HISTORY_LIMIT), present: next, future: state.future.slice(1), selection: selectionForSnapshot(state.selection, next), issues: validateWorkflowDraft(next.workflow) }
    }
    case "selection/set": return { ...state, selection: action.selection }
    case "tool/set": return { ...state, activeTool: action.tool, pendingNodePreset: action.tool === "shape" ? state.pendingNodePreset : null }
    case "node-preset/set": return { ...state, activeTool: "shape", pendingNodePreset: action.presetId, selection: { kind: "none" } }
    case "async/set": return { ...state, asyncState: action.asyncState }
    case "issues/set": return { ...state, issues: [...action.issues] }
  }
}
