import { useEffect, useState, type KeyboardEvent } from "react"
import { useEditorDispatch } from "../../editor/EditorContext"
import type { CanvasNodePresentation, FlowchartShape } from "../../editor/types"
import type { WorkflowNode } from "../../types/workflow"
import { FLOWCHART_SHAPES, flowchartShapeNames, isFlowchartShape } from "./nodes/shapeRegistry"

export interface NodeInspectorProps {
  node: WorkflowNode
  presentation: CanvasNodePresentation
  disabled: boolean
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur()
}

function NodeInspector({ node, presentation, disabled }: NodeInspectorProps) {
  const dispatch = useEditorDispatch()
  const [title, setTitle] = useState(node.title)
  const [description, setDescription] = useState(node.description)
  const [application, setApplication] = useState(node.application ?? "")
  const [titleError, setTitleError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(node.title)
    setDescription(node.description)
    setApplication(node.application ?? "")
    setTitleError(null)
    setDescriptionError(null)
  }, [node.id, node.title, node.description, node.application])

  const commitTitle = () => {
    if (disabled) return
    const normalized = title.trim()
    if (!normalized) {
      setTitleError("Title is required.")
      return
    }
    setTitle(normalized)
    setTitleError(null)
    dispatch({ type: "node/semantic-commit", nodeId: node.id, fields: { title: normalized } })
  }

  const commitDescription = () => {
    if (disabled) return
    const normalized = description.trim()
    if (!normalized) {
      setDescriptionError("Description is required.")
      return
    }
    setDescription(normalized)
    setDescriptionError(null)
    dispatch({ type: "node/semantic-commit", nodeId: node.id, fields: { description: normalized } })
  }

  const commitApplication = () => {
    if (disabled) return
    const normalized = application.trim()
    setApplication(normalized)
    dispatch({ type: "node/semantic-commit", nodeId: node.id, fields: { application: normalized || null } })
  }

  const commitShape = (value: string) => {
    if (disabled || !isFlowchartShape(value)) return
    dispatch({ type: "node/shape-commit", nodeId: node.id, shape: value })
  }

  const color = presentation.color ?? FLOWCHART_SHAPES[presentation.shape].defaultColor

  return (
    <div className="node-inspector">
      <label className="node-inspector__field">
        <span>Title</span>
        <input value={title} disabled={disabled} aria-invalid={Boolean(titleError)} onChange={(event) => setTitle(event.target.value)} onBlur={commitTitle} onKeyDown={blurOnEnter} />
      </label>
      {titleError && <p className="node-inspector__error" role="alert">{titleError}</p>}

      <label className="node-inspector__field">
        <span>Description</span>
        <textarea value={description} disabled={disabled} aria-invalid={Boolean(descriptionError)} onChange={(event) => setDescription(event.target.value)} onBlur={commitDescription} onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) event.currentTarget.blur()
        }} />
      </label>
      {descriptionError && <p className="node-inspector__error" role="alert">{descriptionError}</p>}

      <label className="node-inspector__field">
        <span>Application</span>
        <input value={application} disabled={disabled} onChange={(event) => setApplication(event.target.value)} onBlur={commitApplication} onKeyDown={blurOnEnter} />
      </label>

      <label className="node-inspector__field">
        <span>Shape</span>
        <select value={presentation.shape} disabled={disabled} onChange={(event) => commitShape(event.target.value)}>
          {flowchartShapeNames.map((shape: FlowchartShape) => <option key={shape} value={shape}>{FLOWCHART_SHAPES[shape].label}</option>)}
        </select>
      </label>

      <label className="node-inspector__field node-inspector__color">
        <span>Color</span>
        <input type="color" value={color} disabled={disabled} onChange={(event) => dispatch({ type: "node/color-commit", nodeId: node.id, color: event.target.value })} />
      </label>

      <label className="node-inspector__field">
        <span>Semantic type</span>
        <input value={node.type} readOnly disabled={disabled} aria-readonly="true" />
      </label>

      <button
        className="node-inspector__delete"
        type="button"
        disabled={disabled}
        onClick={() => dispatch({ type: "node/delete", nodeId: node.id })}
      >
        Delete node
      </button>
    </div>
  )
}

export default NodeInspector
