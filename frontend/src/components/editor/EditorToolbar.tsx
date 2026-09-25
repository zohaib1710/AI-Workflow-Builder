import { useState } from "react"
import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import { autoArrangePresentation } from "../../editor/presentation"
import type { NodeCreationPresetId } from "../../editor/types"
import EditorToolButton from "./EditorToolButton"
import ShapeMenu from "./ShapeMenu"
import { AUTO_ARRANGE_FIT_EVENT } from "./WorkflowEditorCanvas"

export interface EditorToolbarProps {
  editingViewport: boolean
  isRequestLoading?: boolean
}

function EditorToolbar({ editingViewport, isRequestLoading = false }: EditorToolbarProps) {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false)

  const isLoading = isRequestLoading || state?.asyncState.status === "loading"
  const manualToolsDisabled = !editingViewport || isLoading

  const selectPreset = (presetId: NodeCreationPresetId) => {
    if (manualToolsDisabled) return
    dispatch({ type: "node-preset/set", presetId })
    setIsShapeMenuOpen(false)
  }

  const autoArrange = () => {
    if (!state || manualToolsDisabled) return
    const nodePresentations = autoArrangePresentation(
      state.present.workflow,
      state.present.nodePresentations,
    )
    if (nodePresentations === state.present.nodePresentations) return
    dispatch({
      type: "snapshot/record",
      snapshot: { ...state.present, nodePresentations },
    })
    window.dispatchEvent(new Event(AUTO_ARRANGE_FIT_EVENT))
  }

  return (
    <nav className="editor-toolbar" aria-label="Workflow tools">
      {state && (
        <>
          <EditorToolButton
            label="Select"
            icon="S"
            pressed={state.activeTool === "select"}
            disabled={manualToolsDisabled}
            onClick={() => {
              dispatch({ type: "tool/set", tool: "select" })
              setIsShapeMenuOpen(false)
            }}
          />
          <EditorToolButton
            label="Add shape"
            icon="A"
            pressed={state.activeTool === "shape"}
            disabled={manualToolsDisabled}
            aria-expanded={isShapeMenuOpen}
            onClick={() => setIsShapeMenuOpen((open) => !open)}
          />
          {isShapeMenuOpen && <ShapeMenu disabled={manualToolsDisabled} onSelect={selectPreset} />}
          <EditorToolButton
            label="Add text"
            icon="T"
            pressed={state.activeTool === "text"}
            disabled={manualToolsDisabled}
            onClick={() => {
              dispatch({ type: "tool/set", tool: "text" })
              setIsShapeMenuOpen(false)
            }}
          />
          <EditorToolButton
            label="Auto Arrange"
            icon="F"
            disabled={manualToolsDisabled}
            onClick={autoArrange}
          />
          <EditorToolButton
            label="Undo"
            icon="U"
            disabled={manualToolsDisabled || state.past.length === 0}
            onClick={() => dispatch({ type: "history/undo" })}
          />
          <EditorToolButton
            label="Redo"
            icon="R"
            disabled={manualToolsDisabled || state.future.length === 0}
            onClick={() => dispatch({ type: "history/redo" })}
          />
        </>
      )}
    </nav>
  )
}

export default EditorToolbar
