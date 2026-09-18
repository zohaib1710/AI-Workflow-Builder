import { useEditorState } from "../../editor/EditorContext"
import WorkflowCanvas from "../WorkflowCanvas"

function WorkflowEditorCanvas() {
  const editorState = useEditorState()
  const workflow = editorState?.present.workflow ?? null
  const nodePresentations = editorState?.present.nodePresentations

  return (
    <section className="editor-canvas" aria-label="Workflow canvas surface">
      {workflow
        ? <WorkflowCanvas workflow={workflow} nodePresentations={nodePresentations} />
        : <div className="editor-canvas__empty" aria-label="Empty workflow canvas" />}
    </section>
  )
}

export default WorkflowEditorCanvas
