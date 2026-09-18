import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import NodeInspector from "./NodeInspector"

export interface InspectorPanelProps {
  editingViewport: boolean
}

function InspectorPanel({ editingViewport }: InspectorPanelProps) {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  if (!state || !editingViewport || state.selection.kind !== "node") return null

  const selectedNodeId = state.selection.nodeId
  const node = state.present.workflow.nodes.find((candidate) => candidate.id === selectedNodeId)
  const presentation = state.present.nodePresentations[selectedNodeId]
  if (!node || !presentation) return null

  return (
    <aside className="inspector-panel" aria-label="Node inspector">
      <div className="inspector-panel__header">
        <div>
          <p className="inspector-panel__eyebrow">Selected node</p>
          <h2 className="inspector-panel__title">Properties</h2>
        </div>
        <button className="inspector-panel__close" type="button" aria-label="Close node inspector" onClick={() => dispatch({ type: "selection/set", selection: { kind: "none" } })}>Close</button>
      </div>
      <NodeInspector node={node} presentation={presentation} disabled={state.activeTool !== "select" || state.asyncState.status === "loading"} />
    </aside>
  )
}

export default InspectorPanel
