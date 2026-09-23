import { graphlib, layout as dagreLayout } from "@dagrejs/dagre"
import type { Workflow } from "../types/workflow"
import type { WorkflowFlowEdge, WorkflowFlowNode } from "../components/nodes/nodeTypes"
import { FLOWCHART_SHAPES } from "../components/editor/nodes/shapeRegistry"
import { DEFAULT_SHAPE_BY_NODE_TYPE, type FlowchartShape } from "../editor/types"
import { separateNodePresentations } from "../editor/nodePlacement"

export const WORKFLOW_NODE_WIDTH = 280
export const WORKFLOW_NODE_HEIGHT = 180

const LAYOUT_OPTIONS = {
  rankdir: "LR",
  ranker: "network-simplex",
  ranksep: 180,
  nodesep: 96,
  edgesep: 52,
  marginx: 48,
  marginy: 48,
}

export interface WorkflowLayoutResult {
  nodes: WorkflowFlowNode[]
  edges: WorkflowFlowEdge[]
}

export type WorkflowNodeShapes = Readonly<Record<string, FlowchartShape>>

function edgeLabelDimensions(label: string | null): { width: number; height: number } {
  if (!label) return { width: 0, height: 0 }
  return {
    width: Math.min(180, Math.max(52, label.length * 7 + 24)),
    height: 30,
  }
}

function shapeForNode(
  node: Workflow["nodes"][number],
  nodeShapes?: WorkflowNodeShapes,
): FlowchartShape {
  return nodeShapes?.[node.id] ?? DEFAULT_SHAPE_BY_NODE_TYPE[node.type]
}

export function layoutWorkflow(
  workflow: Workflow,
  nodeShapes?: WorkflowNodeShapes,
): WorkflowLayoutResult {
  const graph = new graphlib.Graph({ directed: true, multigraph: true })
  graph.setGraph(LAYOUT_OPTIONS)
  graph.setDefaultEdgeLabel(() => ({}))

  const dimensions = new Map<string, { width: number; height: number }>()
  const shapes = new Map<string, FlowchartShape>()

  workflow.nodes.forEach((node) => {
    const shape = shapeForNode(node, nodeShapes)
    const definition = FLOWCHART_SHAPES[shape]
    shapes.set(node.id, shape)
    dimensions.set(node.id, definition)
    graph.setNode(node.id, {
      width: definition.width,
      height: definition.height,
    })
  })

  workflow.edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target, edgeLabelDimensions(edge.label), edge.id)
  })

  dagreLayout(graph)

  const positionedNodes = workflow.nodes.map((node) => {
    const positionedNode = graph.node(node.id)
    const nodeDimensions = dimensions.get(node.id)
    if (!positionedNode || !Number.isFinite(positionedNode.x) || !Number.isFinite(positionedNode.y)) {
      throw new Error("Dagre did not produce a finite position for a workflow node")
    }
    if (!nodeDimensions) throw new Error("Workflow node dimensions were not registered")

    return {
      id: node.id,
      type: node.type,
      position: {
        x: positionedNode.x - nodeDimensions.width / 2,
        y: positionedNode.y - nodeDimensions.height / 2,
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
  const collisionSafePresentation = separateNodePresentations(
    Object.fromEntries(positionedNodes.map((node) => [node.id, {
      nodeId: node.id,
      shape: shapes.get(node.id) ?? "process",
      position: node.position,
    }])),
    workflow.nodes.map((node) => node.id),
  )
  const nodes = positionedNodes.map((node) => ({
    ...node,
    position: collisionSafePresentation[node.id].position,
  }))

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
