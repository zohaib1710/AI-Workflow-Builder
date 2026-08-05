import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Node,
} from "@xyflow/react"
import { useEffect, useMemo } from "react"
import type { Workflow } from "../types/workflow"
import { layoutWorkflow } from "../lib/layout"
import {
  isSupportedNodeType,
  workflowNodeTypes,
  workflowVisualConfig,
  type WorkflowNodeData,
} from "./nodes/nodeTypes"

export interface WorkflowCanvasProps {
  workflow: Workflow
}

function FitViewAfterLayout({ layoutKey }: { layoutKey: string }) {
  const nodesInitialized = useNodesInitialized()
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (!nodesInitialized) return
    void fitView({ padding: 0.2, minZoom: 0.2, maxZoom: 1.25, duration: 200 })
  }, [fitView, layoutKey, nodesInitialized])

  return null
}

function minimapNodeColor(node: Node<WorkflowNodeData>): string {
  return workflowVisualConfig[node.data.nodeType]?.minimapColor ?? "#94a3b8"
}

function layoutIdentity(workflow: Workflow): string {
  return [
    workflow.nodes.map((node) => node.id).join(","),
    workflow.edges.map((edge) => `${edge.id}:${edge.source}:${edge.target}`).join(","),
  ].join("|")
}

function WorkflowCanvasInner({ workflow }: WorkflowCanvasProps) {
  const layoutedWorkflow = useMemo(() => layoutWorkflow(workflow), [workflow])
  const layoutKey = layoutIdentity(workflow)

  return (
    <div className="workflow-canvas" aria-label="Read-only workflow diagram">
      <ReactFlow
        key={layoutKey}
        nodes={layoutedWorkflow.nodes}
        edges={layoutedWorkflow.edges}
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
        <FitViewAfterLayout layoutKey={layoutKey} />
        <Background color="#cbd5e1" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap nodeColor={minimapNodeColor} pannable zoomable />
      </ReactFlow>
    </div>
  )
}

function WorkflowCanvas({ workflow }: WorkflowCanvasProps) {
  if (workflow.nodes.some((node) => !isSupportedNodeType(node.type))) {
    return <p role="alert" className="workflow-canvas__error">This workflow contains an unsupported node type and cannot be displayed.</p>
  }

  return <WorkflowCanvasInner workflow={workflow} />
}

export { buildFlowEdges, buildFlowNodes } from "../lib/layout"
export default WorkflowCanvas
