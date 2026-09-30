import { createContext, type Dispatch, type ReactNode, useContext, useReducer } from "react"
import type { Workflow } from "../types/workflow"
import { createInitialEditorState, editorReducer, type EditorAction } from "./editorReducer"
import type { EditorSnapshot, EditorState } from "./types"

export type EditorSessionAction =
  | EditorAction
  | { type: "workflow/adopt"; workflow: Workflow }
  | { type: "workflow/reset" }

const EditorStateContext = createContext<EditorState | null | undefined>(undefined)
const EditorDispatchContext = createContext<Dispatch<EditorSessionAction> | undefined>(undefined)

export interface EditorProviderProps {
  workflow?: Workflow
  initialSnapshot?: EditorSnapshot
  children: ReactNode
}

function editorSessionReducer(state: EditorState | null, action: EditorSessionAction): EditorState | null {
  if (action.type === "workflow/adopt") return createInitialEditorState(action.workflow)
  if (action.type === "workflow/reset") return null
  if (state === null) return state
  return editorReducer(state, action)
}

export function EditorProvider({ workflow, initialSnapshot, children }: EditorProviderProps) {
  const [state, dispatch] = useReducer(
    editorSessionReducer,
    { workflow: workflow ?? initialSnapshot?.workflow ?? null, snapshot: initialSnapshot },
    (initial) => {
      if (!initial.workflow) return null
      const state = createInitialEditorState(initial.workflow)
      return initial.snapshot ? { ...state, present: initial.snapshot } : state
    },
  )
  return (
    <EditorStateContext.Provider value={state}>
      <EditorDispatchContext.Provider value={dispatch}>{children}</EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  )
}

export function useEditorState(): EditorState | null {
  const state = useContext(EditorStateContext)
  if (state === undefined) throw new Error("useEditorState must be used within EditorProvider.")
  return state
}

export function useEditorDispatch(): Dispatch<EditorSessionAction> {
  const dispatch = useContext(EditorDispatchContext)
  if (dispatch === undefined) throw new Error("useEditorDispatch must be used within EditorProvider.")
  return dispatch
}
