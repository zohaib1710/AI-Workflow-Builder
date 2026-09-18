import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Node,
  type NodeTypes,
} from "@xyflow/react"
import { useEffect, useMemo } from "react"
import { DEFAULT_SHAPE_BY_NODE_TYPE, type CanvasNodePresentation } from "../editor/types"
import type { Workflow } from "../types/workflow"
import { layoutWorkflow } from "../lib/layout"
import { flowchartNodeTypes, type FlowchartFlowNode, type FlowchartNodeData } from "./editor/nodes/FlowchartNode"
import {
  isSupportedNodeType,
  workflowNodeTypes,
  workflowVisualConfig,
  type WorkflowFlowNode,
  type WorkflowNodeData,
} from "./nodes/nodeTypes"

type CanvasFlowNode = WorkflowFlowNode | FlowchartFlowNode

const canvasNodeTypes = {
  ...workflowNodeTypes,
  ...flowchartNodeTypes,
} satisfies NodeTypes

export interface WorkflowCanvasProps {
  workflow: Workflow
  nodePresentations?: Record<string, CanvasNodePresentation>
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

function minimapNodeColor(node: Node<WorkflowNodeData | FlowchartNodeData>): string {
  return workflowVisualConfig[node.data.nodeType]?.minimapColor ?? "#94a3b8"
}

function layoutIdentity(workflow: Workflow, nodePresentations?: Record<string, CanvasNodePresentation>): string {
  return [
    workflow.nodes.map((node) => node.id).join(","),
    workflow.edges.map((edge) => `${edge.id}:${edge.source}:${edge.target}`).join(","),
    nodePresentations
      ? workflow.nodes.map((node) => {
          const presentation = nodePresentations[node.id]
          return presentation ? `${node.id}:${presentation.shape}:${presentation.position.x}:${presentation.position.y}` : `${node.id}:default`
        }).join(",")
      : "legacy",
  ].join("|")
}

function WorkflowCanvasInner({ workflow, nodePresentations }: WorkflowCanvasProps) {
  const layoutedWorkflow = useMemo(() => layoutWorkflow(workflow), [workflow])
  const renderedNodes = useMemo<CanvasFlowNode[]>(() => {
    if (!nodePresentations) return layoutedWorkflow.nodes

    return layoutedWorkflow.nodes.map((node) => {
      const presentation = nodePresentations[node.id]
      return {
        ...node,
        type: "flowchart" as const,
        position: presentation?.position ?? node.position,
        data: {
          ...node.data,
          shape: presentation?.shape ?? DEFAULT_SHAPE_BY_NODE_TYPE[node.data.nodeType],
        },
      }
    })
  }, [layoutedWorkflow.nodes, nodePresentations])
  const layoutKey = layoutIdentity(workflow, nodePresentations)

  return (
    <div className="workflow-canvas" aria-label="Read-only workflow diagram">
      <ReactFlow
        key={layoutKey}
        nodes={renderedNodes}
        edges={layoutedWorkflow.edges}
        nodeTypes={canvasNodeTypes}
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
        <Background color="#303030" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap nodeColor={minimapNodeColor} pannable zoomable />
      </ReactFlow>
    </div>
  )
}

function WorkflowCanvas({ workflow, nodePresentations }: WorkflowCanvasProps) {
  if (workflow.nodes.some((node) => !isSupportedNodeType(node.type))) {
    return <p role="alert" className="workflow-canvas__error">This workflow contains an unsupported node type and cannot be displayed.</p>
  }

  return <WorkflowCanvasInner workflow={workflow} nodePresentations={nodePresentations} />
}

export { buildFlowEdges, buildFlowNodes } from "../lib/layout"
export default WorkflowCanvas
