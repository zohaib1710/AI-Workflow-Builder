import type { Workflow } from "../types/workflow"
import { createInitialPresentation } from "./presentation"
import type { EditorAsyncState, EditorSelection, EditorSnapshot, EditorState, EditorTool, EditorValidationIssue } from "./types"
import { validateWorkflowDraft } from "./validation"

export const EDITOR_HISTORY_LIMIT = 100

export type RecordedEditorAction = { type: "snapshot/record"; snapshot: EditorSnapshot }
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

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "snapshot/record":
      return { ...state, past: [...state.past, state.present].slice(-EDITOR_HISTORY_LIMIT), present: action.snapshot, future: [], issues: validateWorkflowDraft(action.snapshot.workflow) }
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
