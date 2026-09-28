import { useState } from "react"
import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import type { NodeCreationPresetId } from "../../editor/types"
import EditorToolButton from "./EditorToolButton"
import Icon from "./EditorIcons"
import ShapeMenu from "./ShapeMenu"

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

  return (
    <nav className="editor-toolbar" aria-label="Workflow tools">
      {state && (
        <>
          <EditorToolButton
            label="Select"
            icon={<Icon name="select" />}
            pressed={state.activeTool === "select"}
            disabled={manualToolsDisabled}
            onClick={() => {
              dispatch({ type: "tool/set", tool: "select" })
              setIsShapeMenuOpen(false)
            }}
          />
          <EditorToolButton
            label="Add shape"
            icon={<Icon name="shape" />}
            pressed={isShapeMenuOpen}
            disabled={manualToolsDisabled}
            aria-expanded={isShapeMenuOpen}
            onClick={() => setIsShapeMenuOpen((open) => !open)}
          />
          {isShapeMenuOpen && <ShapeMenu disabled={manualToolsDisabled} onSelect={selectPreset} />}
          <EditorToolButton
            label="Add text"
            icon={<Icon name="text" />}
            disabled={manualToolsDisabled}
            onClick={() => {
              dispatch({ type: "tool/set", tool: "text" })
              setIsShapeMenuOpen(false)
            }}
          />
          <span className="editor-toolbar__divider" aria-hidden="true" />
          <EditorToolButton
            label="Undo"
            icon={<Icon name="undo" />}
            disabled={manualToolsDisabled || state.past.length === 0}
            onClick={() => dispatch({ type: "history/undo" })}
          />
          <EditorToolButton
            label="Redo"
            icon={<Icon name="redo" />}
            disabled={manualToolsDisabled || state.future.length === 0}
            onClick={() => dispatch({ type: "history/redo" })}
          />
        </>
      )}
    </nav>
  )
}

export default EditorToolbar
