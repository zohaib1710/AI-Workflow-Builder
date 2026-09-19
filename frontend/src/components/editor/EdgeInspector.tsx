import { useEffect, useState, type KeyboardEvent } from "react"
import { useEditorDispatch } from "../../editor/EditorContext"
import type { WorkflowEdge } from "../../types/workflow"

export interface EdgeInspectorProps {
  edge: WorkflowEdge
  sourceTitle: string
  targetTitle: string
  disabled: boolean
}

function EdgeInspector({ edge, sourceTitle, targetTitle, disabled }: EdgeInspectorProps) {
  const dispatch = useEditorDispatch()
  const [label, setLabel] = useState(edge.label ?? "")

  useEffect(() => {
    setLabel(edge.label ?? "")
  }, [edge.id, edge.label])

  const commitLabel = () => {
    if (disabled) return
    const normalized = label.trim()
    setLabel(normalized)
    dispatch({ type: "edge/label-commit", edgeId: edge.id, label: normalized || null })
  }

  const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur()
  }

  return (
    <div className="edge-inspector">
      <label className="node-inspector__field">
        <span>Source</span>
        <input value={sourceTitle} readOnly aria-readonly="true" />
      </label>
      <label className="node-inspector__field">
        <span>Target</span>
        <input value={targetTitle} readOnly aria-readonly="true" />
      </label>
      <label className="node-inspector__field">
        <span>Label</span>
        <input value={label} disabled={disabled} onChange={(event) => setLabel(event.target.value)} onBlur={commitLabel} onKeyDown={blurOnEnter} />
      </label>
      <button className="node-inspector__delete" type="button" disabled={disabled} onClick={() => dispatch({ type: "edge/delete", edgeId: edge.id })}>
        Delete connection
      </button>
    </div>
  )
}

export default EdgeInspector
