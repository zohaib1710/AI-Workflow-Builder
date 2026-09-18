import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react"
import { useEffect, useMemo, useState } from "react"
import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import { DEFAULT_SHAPE_BY_NODE_TYPE } from "../../editor/types"
import { isSupportedNodeType, workflowVisualConfig } from "../nodes/nodeTypes"
import { flowchartNodeTypes, type FlowchartFlowNode, type FlowchartNodeData } from "./nodes/FlowchartNode"

export interface WorkflowEditorCanvasProps {
  editingViewport: boolean
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

function buildEdges(edges: { id: string; source: string; target: string; label: string | null }[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: edge.label,
    selectable: false,
    focusable: false,
    labelShowBg: edge.label !== null,
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
    style: { stroke: "#64748b", strokeWidth: 1.5 },
  }))
}

function minimapNodeColor(node: Node<FlowchartNodeData>): string {
  return workflowVisualConfig[node.data.nodeType]?.minimapColor ?? "#94a3b8"
}

function WorkflowEditorCanvas({ editingViewport }: WorkflowEditorCanvasProps) {
  const editorState = useEditorState()
  const dispatch = useEditorDispatch()
  const workflow = editorState?.present.workflow ?? null
  const canEdit = Boolean(editorState && editingViewport && editorState.activeTool === "select" && editorState.asyncState.status === "idle")
  const derivedNodes = useMemo<FlowchartFlowNode[]>(() => {
    if (!editorState || !workflow) return []
    return workflow.nodes.map((node, index) => {
      const presentation = editorState.present.nodePresentations[node.id]
      return {
        id: node.id,
        type: "flowchart",
        position: presentation?.position ?? { x: 0, y: index * 190 },
        data: {
          nodeType: node.type,
          title: node.title,
          description: node.description,
          application: node.application,
          shape: presentation?.shape ?? DEFAULT_SHAPE_BY_NODE_TYPE[node.type],
        },
        draggable: canEdit,
        connectable: false,
        selectable: canEdit,
        deletable: false,
        focusable: canEdit,
        selected: editorState.selection.kind === "node" && editorState.selection.nodeId === node.id,
      }
    })
  }, [canEdit, editorState, workflow])
  const [nodes, setNodes] = useState<FlowchartFlowNode[]>(derivedNodes)
  const edges = useMemo(() => buildEdges(workflow?.edges ?? []), [workflow?.edges])
  const layoutKey = workflow ? `${workflow.nodes.map((node) => node.id).join(",")}|${workflow.edges.map((edge) => edge.id).join(",")}` : "empty"

  useEffect(() => setNodes(derivedNodes), [derivedNodes])

  if (!workflow || !editorState) {
    return (
      <section className="editor-canvas" aria-label="Workflow canvas surface">
        <div className="editor-canvas__empty" aria-label="Empty workflow canvas" />
      </section>
    )
  }

  if (workflow.nodes.some((node) => !isSupportedNodeType(node.type))) {
    return (
      <section className="editor-canvas" aria-label="Workflow canvas surface">
        <p role="alert" className="workflow-canvas__error">This workflow contains an unsupported node type and cannot be displayed.</p>
      </section>
    )
  }

  return (
    <section className="editor-canvas" aria-label="Workflow canvas surface">
      <div className="workflow-canvas" aria-label="Read-only workflow diagram">
        <ReactFlow<FlowchartFlowNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={flowchartNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.35, maxZoom: 1.2 }}
          nodesDraggable={canEdit}
          nodesConnectable={false}
          elementsSelectable={canEdit}
          nodesFocusable={canEdit}
          edgesFocusable={false}
          deleteKeyCode={null}
          multiSelectionKeyCode={null}
          selectionOnDrag={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            if (canEdit) dispatch({ type: "selection/set", selection: { kind: "node", nodeId: node.id } })
          }}
          onPaneClick={() => dispatch({ type: "selection/set", selection: { kind: "none" } })}
          onNodeDrag={(_, draggedNode) => {
            if (!canEdit) return
            setNodes((current) => current.map((node) => node.id === draggedNode.id ? { ...node, position: { ...draggedNode.position } } : node))
          }}
          onNodeDragStop={(_, draggedNode) => {
            if (!canEdit) return
            dispatch({ type: "node/position-commit", nodeId: draggedNode.id, position: { ...draggedNode.position } })
          }}
        >
          <FitViewAfterLayout layoutKey={layoutKey} />
          <Background color="#303030" gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap nodeColor={minimapNodeColor} pannable zoomable />
        </ReactFlow>
      </div>
    </section>
  )
}

export default WorkflowEditorCanvas
