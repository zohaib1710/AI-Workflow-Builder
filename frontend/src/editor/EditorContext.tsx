import { createContext, type Dispatch, type ReactNode, useContext, useReducer } from "react"
import type { Workflow } from "../types/workflow"
import { createInitialEditorState, editorReducer, type EditorAction } from "./editorReducer"
import type { EditorState } from "./types"

const EditorStateContext = createContext<EditorState | undefined>(undefined)
const EditorDispatchContext = createContext<Dispatch<EditorAction> | undefined>(undefined)

export interface EditorProviderProps { workflow: Workflow; children: ReactNode }

export function EditorProvider({ workflow, children }: EditorProviderProps) {
  const [state, dispatch] = useReducer(editorReducer, workflow, createInitialEditorState)
  return (
    <EditorStateContext.Provider value={state}>
      <EditorDispatchContext.Provider value={dispatch}>{children}</EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  )
}

export function useEditorState(): EditorState {
  const state = useContext(EditorStateContext)
  if (state === undefined) throw new Error("useEditorState must be used within EditorProvider.")
  return state
}

export function useEditorDispatch(): Dispatch<EditorAction> {
  const dispatch = useContext(EditorDispatchContext)
  if (dispatch === undefined) throw new Error("useEditorDispatch must be used within EditorProvider.")
  return dispatch
}
