import { graphlib, layout as dagreLayout } from "@dagrejs/dagre"
import type { Workflow } from "../types/workflow"
import type { WorkflowFlowEdge, WorkflowFlowNode } from "../components/nodes/nodeTypes"

export const WORKFLOW_NODE_WIDTH = 280
export const WORKFLOW_NODE_HEIGHT = 170

const LAYOUT_OPTIONS = {
  rankdir: "LR",
  ranksep: 90,
  nodesep: 50,
  edgesep: 30,
  marginx: 30,
  marginy: 30,
}

export interface WorkflowLayoutResult {
  nodes: WorkflowFlowNode[]
  edges: WorkflowFlowEdge[]
}

export function layoutWorkflow(workflow: Workflow): WorkflowLayoutResult {
  const graph = new graphlib.Graph({ directed: true, multigraph: true })
  graph.setGraph(LAYOUT_OPTIONS)
  graph.setDefaultEdgeLabel(() => ({}))

  workflow.nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: WORKFLOW_NODE_WIDTH,
      height: WORKFLOW_NODE_HEIGHT,
    })
  })

  workflow.edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target, {}, edge.id)
  })

  dagreLayout(graph)

  const nodes = workflow.nodes.map((node) => {
    const positionedNode = graph.node(node.id)
    if (!positionedNode || !Number.isFinite(positionedNode.x) || !Number.isFinite(positionedNode.y)) {
      throw new Error("Dagre did not produce a finite position for a workflow node")
    }

    return {
      id: node.id,
      type: node.type,
      position: {
        x: positionedNode.x - WORKFLOW_NODE_WIDTH / 2,
        y: positionedNode.y - WORKFLOW_NODE_HEIGHT / 2,
      },
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
    }
  })

  const edges = workflow.edges.map((edge) => ({
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

  return { nodes, edges }
}

export const buildFlowNodes = layoutWorkflow

export function buildFlowEdges(workflow: Workflow): WorkflowFlowEdge[] {
  return layoutWorkflow(workflow).edges
}
