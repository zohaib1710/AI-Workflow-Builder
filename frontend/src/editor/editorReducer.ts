import type { Workflow, WorkflowNode } from "../types/workflow"
import { createInitialPresentation } from "./presentation"
import type { CanvasPosition, EditorAsyncState, EditorSelection, EditorSnapshot, EditorState, EditorTool, EditorValidationIssue, FlowchartShape } from "./types"
import { validateWorkflowDraft } from "./validation"

export const EDITOR_HISTORY_LIMIT = 100

type EditableNodeFields = Partial<Pick<WorkflowNode, "title" | "description" | "application">>

export type RecordedEditorAction =
  | { type: "snapshot/record"; snapshot: EditorSnapshot }
  | { type: "node/position-commit"; nodeId: string; position: CanvasPosition }
  | { type: "node/semantic-commit"; nodeId: string; fields: EditableNodeFields }
  | { type: "node/shape-commit"; nodeId: string; shape: FlowchartShape }
export type SkippedEditorAction =
  | { type: "selection/set"; selection: EditorSelection }
  | { type: "tool/set"; tool: EditorTool }
  | { type: "async/set"; asyncState: EditorAsyncState }
  | { type: "issues/set"; issues: EditorValidationIssue[] }
export type EditorAction = RecordedEditorAction | SkippedEditorAction | { type: "history/undo" } | { type: "history/redo" }

export function createEditorSnapshot(workflow: Workflow): EditorSnapshot {
  return { workflow, nodePresentations: createInitialPresentation(workflow), annotations: [] }
}

export function createInitialEditorState(workflow: Workflow): EditorState {
  return {
    past: [], future: [], present: createEditorSnapshot(workflow),
    selection: { kind: "none" }, activeTool: "select", asyncState: { status: "idle" },
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
    case "history/undo": {
      const previous = state.past.at(-1)
      if (previous === undefined) return state
      return { ...state, past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], issues: validateWorkflowDraft(previous.workflow) }
    }
    case "history/redo": {
      const next = state.future[0]
      if (next === undefined) return state
      return { ...state, past: [...state.past, state.present].slice(-EDITOR_HISTORY_LIMIT), present: next, future: state.future.slice(1), issues: validateWorkflowDraft(next.workflow) }
    }
    case "selection/set": return { ...state, selection: action.selection }
    case "tool/set": return { ...state, activeTool: action.tool }
    case "async/set": return { ...state, asyncState: action.asyncState }
    case "issues/set": return { ...state, issues: [...action.issues] }
  }
}
