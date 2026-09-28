import { Handle, Position, type Node, type NodeProps, type NodeTypes } from "@xyflow/react"
import { memo, type CSSProperties } from "react"
import type { SupportedNodeType } from "../../../types/workflow"
import { workflowVisualConfig } from "../../nodes/nodeTypes"
import ShapeGeometry from "./shapeGeometry"
import { FLOWCHART_SHAPES, isFlowchartShape } from "./shapeRegistry"

export interface FlowchartNodeData extends Record<string, unknown> {
  nodeType: SupportedNodeType
  title: string
  description: string
  application: string | null
  shape: string
  color: string
  hasIncomingConnection: boolean
  hasOutgoingConnection: boolean
}

export type FlowchartFlowNode = Node<FlowchartNodeData, "flowchart">

type ShapeStyle = CSSProperties & {
  "--flowchart-shape-width": string
  "--flowchart-shape-height": string
  "--flowchart-accent": string
}

const FlowchartNode = memo(function FlowchartNode({ data, selected, isConnectable }: NodeProps<FlowchartFlowNode>) {
  const requestedShape = data.shape
  const supportedShape = isFlowchartShape(requestedShape)
  const shape = supportedShape ? requestedShape : "process"
  const definition = FLOWCHART_SHAPES[shape]
  const semantic = workflowVisualConfig[data.nodeType]
  const style: ShapeStyle = {
    "--flowchart-shape-width": `${definition.width}px`,
    "--flowchart-shape-height": `${definition.height}px`,
    "--flowchart-accent": data.color,
  }

  return (
    <div
      className={`flowchart-node flowchart-node--${data.nodeType}${selected ? " flowchart-node--selected" : ""}`}
      data-shape={shape}
      data-shape-status={supportedShape ? "supported" : "unsupported"}
      style={style}
      role="group"
      aria-label={`${semantic.label}: ${data.title}`}
    >
      {data.nodeType !== "start" && (
        <Handle
          id="incoming"
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          aria-label={data.hasIncomingConnection ? "Incoming connection" : "Connect incoming side"}
          className={`flowchart-node__handle${data.hasIncomingConnection ? "" : " flowchart-node__handle--missing"}${isConnectable ? "" : " flowchart-node__handle--disabled"}`}
        >
          {!data.hasIncomingConnection && <span aria-hidden="true" className="flowchart-node__handle-arrow">→</span>}
        </Handle>
      )}
      <div className="flowchart-node__shape">
        <ShapeGeometry shape={shape} />
        <div className={`flowchart-node__content ${definition.contentClassName}`}>
          <span className="flowchart-node__semantic">{semantic.label}</span>
          <h3 className="flowchart-node__title" title={data.title}>{data.title}</h3>
          <p className="flowchart-node__description" title={data.description}>{data.description}</p>
          {data.application && <p className="flowchart-node__application" title={data.application}>{data.application}</p>}
          {!supportedShape && <span className="flowchart-node__warning">Unsupported shape</span>}
        </div>
      </div>
      {data.nodeType !== "end" && (
        <Handle
          id="outgoing"
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          aria-label={data.hasOutgoingConnection ? "Outgoing connection" : "Connect outgoing side"}
          className={`flowchart-node__handle${data.hasOutgoingConnection ? "" : " flowchart-node__handle--missing"}${isConnectable ? "" : " flowchart-node__handle--disabled"}`}
        >
          {!data.hasOutgoingConnection && <span aria-hidden="true" className="flowchart-node__handle-arrow">→</span>}
        </Handle>
      )}
    </div>
  )
})

export const flowchartNodeTypes = { flowchart: FlowchartNode } satisfies NodeTypes

export default FlowchartNode
