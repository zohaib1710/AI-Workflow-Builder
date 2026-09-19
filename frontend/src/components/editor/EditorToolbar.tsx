import { useState } from "react"
import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import type { NodeCreationPresetId } from "../../editor/types"
import EditorToolButton from "./EditorToolButton"
import ShapeMenu from "./ShapeMenu"

export interface EditorToolbarProps {
  editingViewport: boolean
  onNewWorkflow: () => void
}

function EditorToolbar({ editingViewport, onNewWorkflow }: EditorToolbarProps) {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false)
  if (!state) return null

  const isLoading = state.asyncState.status === "loading"
  const manualToolsDisabled = !editingViewport || isLoading

  const selectPreset = (presetId: NodeCreationPresetId) => {
    if (manualToolsDisabled) return
    dispatch({ type: "node-preset/set", presetId })
    setIsShapeMenuOpen(false)
  }

  return (
    <nav className="editor-toolbar" aria-label="Workflow tools">
      <EditorToolButton
        label="New workflow"
        icon="+"
        disabled={isLoading}
        onClick={onNewWorkflow}
      />
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
        label="Connect"
        icon="C"
        pressed={state.activeTool === "connector"}
        disabled={manualToolsDisabled}
        onClick={() => {
          dispatch({ type: "tool/set", tool: "connector" })
          setIsShapeMenuOpen(false)
        }}
      />
    </nav>
  )
}

export default EditorToolbar
