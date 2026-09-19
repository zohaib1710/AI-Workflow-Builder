import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import AnnotationInspector from "./AnnotationInspector"
import EdgeInspector from "./EdgeInspector"
import NodeInspector from "./NodeInspector"

export interface InspectorPanelProps {
  editingViewport: boolean
}

function InspectorPanel({ editingViewport }: InspectorPanelProps) {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  if (!state || state.selection.kind === "none") return null

  if (state.selection.kind === "node") {
    if (!editingViewport) return null
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

  if (state.selection.kind === "annotation") {
    const selectedAnnotationId = state.selection.annotationId
    const annotation = state.present.annotations.find((candidate) => candidate.id === selectedAnnotationId)
    if (!annotation) return null
    const disabled = !editingViewport || state.activeTool !== "select" || state.asyncState.status === "loading"
    return (
      <aside className="inspector-panel" aria-label="Annotation inspector">
        <div className="inspector-panel__header">
          <div>
            <p className="inspector-panel__eyebrow">Selected annotation</p>
            <h2 className="inspector-panel__title">Properties</h2>
          </div>
          <button className="inspector-panel__close" type="button" aria-label="Close annotation inspector" onClick={() => dispatch({ type: "selection/set", selection: { kind: "none" } })}>Close</button>
        </div>
        <AnnotationInspector annotation={annotation} disabled={disabled} />
      </aside>
    )
  }

  const selectedEdgeId = state.selection.edgeId
  const edge = state.present.workflow.edges.find((candidate) => candidate.id === selectedEdgeId)
  if (!edge) return null
  const sourceTitle = state.present.workflow.nodes.find((node) => node.id === edge.source)?.title ?? edge.source
  const targetTitle = state.present.workflow.nodes.find((node) => node.id === edge.target)?.title ?? edge.target
  const disabled = !editingViewport || state.activeTool !== "select" || state.asyncState.status === "loading"

  return (
    <aside className="inspector-panel" aria-label="Edge inspector">
      <div className="inspector-panel__header">
        <div>
          <p className="inspector-panel__eyebrow">Selected connection</p>
          <h2 className="inspector-panel__title">Properties</h2>
        </div>
        <button className="inspector-panel__close" type="button" aria-label="Close edge inspector" onClick={() => dispatch({ type: "selection/set", selection: { kind: "none" } })}>Close</button>
      </div>
      <EdgeInspector edge={edge} sourceTitle={sourceTitle} targetTitle={targetTitle} disabled={disabled} />
    </aside>
  )
}

export default InspectorPanel
