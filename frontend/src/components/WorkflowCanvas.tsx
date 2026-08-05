import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react"
import type { Workflow } from "../types/workflow"
import {
  isSupportedNodeType,
  workflowNodeTypes,
  workflowVisualConfig,
  type WorkflowFlowEdge,
  type WorkflowFlowNode,
  type WorkflowNodeData,
} from "./nodes/nodeTypes"

const TEMPORARY_HORIZONTAL_GAP = 320

export interface WorkflowCanvasProps {
  workflow: Workflow
}

export function buildFlowNodes(workflow: Workflow): WorkflowFlowNode[] {
  return workflow.nodes.map((node, index) => ({
    id: node.id,
    type: node.type,
    position: { x: index * TEMPORARY_HORIZONTAL_GAP, y: 0 },
    data: {
      nodeType: node.type,
      title: node.title,
      description: node.description,
      application: node.application,
    },
    draggable: false,
    connectable: false,
    selectable: false,
    deletable: false,
    focusable: false,
  }))
}

export function buildFlowEdges(workflow: Workflow): WorkflowFlowEdge[] {
  return workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: edge.label,
    labelShowBg: edge.label !== null,
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
    style: { stroke: "#64748b", strokeWidth: 1.5 },
  }))
}

function unsupportedNodeExists(workflow: Workflow): boolean {
  return workflow.nodes.some((node) => !isSupportedNodeType(node.type))
}

function minimapNodeColor(node: Node<WorkflowNodeData>): string {
  return workflowVisualConfig[node.data.nodeType]?.minimapColor ?? "#94a3b8"
}

function WorkflowCanvas({ workflow }: WorkflowCanvasProps) {
  if (unsupportedNodeExists(workflow)) {
    return <p role="alert" className="workflow-canvas__error">This workflow contains an unsupported node type and cannot be displayed.</p>
  }

  const nodes = buildFlowNodes(workflow)
  const edges = buildFlowEdges(workflow)

  return (
    <div className="workflow-canvas" aria-label="Read-only workflow diagram">
      <ReactFlow
        key={`${workflow.nodes.map((node) => node.id).join("-")}:${workflow.edges.map((edge) => edge.id).join("-")}`}
        nodes={nodes}
        edges={edges as Edge[]}
        nodeTypes={workflowNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.35, maxZoom: 1.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        selectionOnDrag={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap nodeColor={minimapNodeColor} pannable zoomable />
      </ReactFlow>
    </div>
  )
}

export default WorkflowCanvas
