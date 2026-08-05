import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { WorkflowFlowNode } from "./nodeTypes"
import { workflowVisualConfig } from "./nodeTypes"

function WorkflowNode({ data }: NodeProps<WorkflowFlowNode>) {
  const config = workflowVisualConfig[data.nodeType]
  const showTarget = data.nodeType !== "start"
  const showSource = data.nodeType !== "end"

  return (
    <article className={`workflow-node ${config.accentClass}`} data-node-type={data.nodeType}>
      {showTarget && <Handle type="target" position={Position.Left} className="workflow-handle" />}
      <div className={`workflow-badge ${config.badgeClass}`}>
        <span aria-hidden="true">{config.symbol}</span>
        <span>{config.label}</span>
      </div>
      <h3 className="workflow-node__title">{data.title}</h3>
      <p className="workflow-node__description">{data.description}</p>
      {data.application && <p className="workflow-node__application"><span>Application:</span> {data.application}</p>}
      {showSource && <Handle type="source" position={Position.Right} className="workflow-handle" />}
    </article>
  )
}

export default WorkflowNode
