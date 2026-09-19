import { useEffect } from "react"
import { useEditorDispatch, useEditorState } from "../editor/EditorContext"

export interface UseEditorShortcutsOptions {
  editingViewport: boolean
  cancelPendingInteraction: () => boolean
}

function isTextEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const field = target.closest("input, textarea, select")
  if (field) return true
  const editable = target.closest("[contenteditable]")
  return editable instanceof HTMLElement && editable.getAttribute("contenteditable") !== "false"
}

function useEditorShortcuts({ editingViewport, cancelPendingInteraction }: UseEditorShortcutsOptions) {
  const state = useEditorState()
  const dispatch = useEditorDispatch()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!state || isTextEditable(event.target)) return
      const key = event.key.toLowerCase()

      if (key === "escape") {
        const canceledPending = cancelPendingInteraction()
        const hasTransientState = state.activeTool !== "select" || state.selection.kind !== "none"
        if (!canceledPending && !hasTransientState) return
        event.preventDefault()
        dispatch({ type: "tool/set", tool: "select" })
        dispatch({ type: "selection/set", selection: { kind: "none" } })
        return
      }

      const historyModifier = event.ctrlKey || event.metaKey
      const redo = historyModifier && (key === "y" || (key === "z" && event.shiftKey))
      const undo = historyModifier && key === "z" && !event.shiftKey
      if (undo && state.past.length > 0) {
        event.preventDefault()
        dispatch({ type: "history/undo" })
        return
      }
      if (redo && state.future.length > 0) {
        event.preventDefault()
        dispatch({ type: "history/redo" })
        return
      }

      const isDelete = !event.ctrlKey && !event.metaKey && !event.altKey && (key === "delete" || key === "backspace")
      if (!isDelete || !editingViewport || state.asyncState.status === "loading" || state.selection.kind === "none") return
      event.preventDefault()
      if (state.selection.kind === "node") {
        dispatch({ type: "node/delete", nodeId: state.selection.nodeId })
      } else if (state.selection.kind === "edge") {
        dispatch({ type: "edge/delete", edgeId: state.selection.edgeId })
      } else {
        dispatch({ type: "annotation/delete", annotationId: state.selection.annotationId })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cancelPendingInteraction, dispatch, editingViewport, state])
}

export default useEditorShortcuts
