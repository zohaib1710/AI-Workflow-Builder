import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import { createUniqueEditorId } from "../../editor/ids"
import { DEFAULT_SHAPE_BY_NODE_TYPE } from "../../editor/types"
import useEditorShortcuts from "../../hooks/useEditorShortcuts"
import { isSupportedNodeType, workflowVisualConfig } from "../nodes/nodeTypes"
import ConnectionLabelDialog from "./ConnectionLabelDialog"
import { annotationNodeTypes, type AnnotationFlowNode, type AnnotationNodeData } from "./nodes/AnnotationNode"
import { flowchartNodeTypes, type FlowchartFlowNode, type FlowchartNodeData } from "./nodes/FlowchartNode"

export interface WorkflowEditorCanvasProps {
  editingViewport: boolean
}

type EditorFlowNode = FlowchartFlowNode | AnnotationFlowNode
const editorNodeTypes = { ...flowchartNodeTypes, ...annotationNodeTypes }

function FitViewAfterLayout({ layoutKey }: { layoutKey: string }) {
  const nodesInitialized = useNodesInitialized()
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (!nodesInitialized) return
    void fitView({ padding: 0.2, minZoom: 0.2, maxZoom: 1.25, duration: 200 })
  }, [fitView, layoutKey, nodesInitialized])

  return null
}

function buildEdges(
  edges: { id: string; source: string; target: string; label: string | null }[],
  selectedEdgeId: string | null,
  selectable: boolean,
): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: edge.label,
    selectable,
    focusable: selectable,
    selected: edge.id === selectedEdgeId,
    labelShowBg: edge.label !== null,
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
    style: { stroke: "#64748b", strokeWidth: 1.5 },
  }))
}

function minimapNodeColor(node: Node<FlowchartNodeData | AnnotationNodeData>): string {
  const nodeType = node.data.nodeType
  if (typeof nodeType !== "string" || !isSupportedNodeType(nodeType)) return "#a1a1aa"
  return workflowVisualConfig[nodeType].minimapColor
}

function WorkflowEditorCanvas({ editingViewport }: WorkflowEditorCanvasProps) {
  const editorState = useEditorState()
  const dispatch = useEditorDispatch()
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<EditorFlowNode> | null>(null)
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null)
  const workflow = editorState?.present.workflow ?? null
  const mutationsEnabled = Boolean(editorState && editingViewport && editorState.asyncState.status === "idle")
  const canEdit = Boolean(mutationsEnabled && editorState?.activeTool === "select")
  const canPlaceNode = Boolean(mutationsEnabled && editorState?.activeTool === "shape" && editorState.pendingNodePreset)
  const canPlaceAnnotation = Boolean(mutationsEnabled && editorState?.activeTool === "text")
  const canConnect = Boolean(mutationsEnabled && editorState?.activeTool === "connector")
  const derivedNodes = useMemo<EditorFlowNode[]>(() => {
    if (!editorState || !workflow) return []
    const workflowNodes: FlowchartFlowNode[] = workflow.nodes.map((node, index) => {
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
        connectable: canConnect,
        selectable: canEdit,
        deletable: false,
        focusable: canEdit,
        selected: editorState.selection.kind === "node" && editorState.selection.nodeId === node.id,
      }
    })
    const annotationNodes: AnnotationFlowNode[] = editorState.present.annotations.map((annotation) => ({
      id: annotation.id,
      type: "annotation",
      position: annotation.position,
      data: { text: annotation.text },
      draggable: canEdit,
      connectable: false,
      selectable: canEdit,
      deletable: false,
      focusable: canEdit,
      selected: editorState.selection.kind === "annotation" && editorState.selection.annotationId === annotation.id,
    }))
    return [...workflowNodes, ...annotationNodes]
  }, [canConnect, canEdit, editorState, workflow])
  const [nodes, setNodes] = useState<EditorFlowNode[]>(derivedNodes)
  const selectedEdgeId = editorState?.selection.kind === "edge" ? editorState.selection.edgeId : null
  const edges = useMemo(
    () => buildEdges(workflow?.edges ?? [], selectedEdgeId, canEdit),
    [canEdit, selectedEdgeId, workflow?.edges],
  )
  const layoutKey = workflow ? `${workflow.nodes.map((node) => node.id).join(",")}|${workflow.edges.map((edge) => edge.id).join(",")}` : "empty"

  useEffect(() => setNodes(derivedNodes), [derivedNodes])
  useEffect(() => {
    if (!canConnect) setPendingConnection(null)
  }, [canConnect])
  const cancelPendingInteraction = useCallback(() => {
    if (!pendingConnection) return false
    setPendingConnection(null)
    return true
  }, [pendingConnection])
  useEditorShortcuts({ editingViewport, cancelPendingInteraction })

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

  const commitConnection = (source: string, target: string, label: string | null) => {
    if (!canConnect) return
    const edgeId = createUniqueEditorId("edge", new Set(workflow.edges.map((edge) => edge.id)))
    dispatch({ type: "edge/create", edge: { id: edgeId, source, target, label } })
  }

  const requestConnection = (connection: Connection) => {
    if (!canConnect || !connection.source || !connection.target || connection.source === connection.target) return
    const sourceNode = workflow.nodes.find((node) => node.id === connection.source)
    const targetExists = workflow.nodes.some((node) => node.id === connection.target)
    if (!sourceNode || !targetExists) return
    if (sourceNode.type === "decision") {
      setPendingConnection({ source: connection.source, target: connection.target })
      return
    }
    commitConnection(connection.source, connection.target, null)
  }

  return (
    <section className={`editor-canvas${canPlaceNode || canPlaceAnnotation ? " editor-canvas--placing" : ""}`} aria-label="Workflow canvas surface">
      <div className="workflow-canvas" aria-label="Read-only workflow diagram">
        <ReactFlow<EditorFlowNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={editorNodeTypes}
          onInit={setFlowInstance}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.35, maxZoom: 1.2 }}
          nodesDraggable={canEdit}
          nodesConnectable={canConnect}
          elementsSelectable={canEdit}
          nodesFocusable={canEdit}
          edgesFocusable={canEdit}
          deleteKeyCode={null}
          multiSelectionKeyCode={null}
          selectionOnDrag={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            if (!canEdit) return
            dispatch({
              type: "selection/set",
              selection: node.type === "annotation"
                ? { kind: "annotation", annotationId: node.id }
                : { kind: "node", nodeId: node.id },
            })
          }}
          onEdgeClick={(_, edge) => {
            if (canEdit) dispatch({ type: "selection/set", selection: { kind: "edge", edgeId: edge.id } })
          }}
          onConnect={requestConnection}
          onPaneClick={(event) => {
            if (canPlaceNode && editorState.pendingNodePreset && flowInstance) {
              const position = flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
              const nodeId = createUniqueEditorId("node", new Set(workflow.nodes.map((node) => node.id)))
              dispatch({ type: "node/create", nodeId, presetId: editorState.pendingNodePreset, position })
              return
            }
            if (canPlaceAnnotation && flowInstance) {
              const position = flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
              const annotationId = createUniqueEditorId(
                "annotation",
                new Set(editorState.present.annotations.map((annotation) => annotation.id)),
              )
              dispatch({
                type: "annotation/create",
                annotation: { id: annotationId, text: "Text", position },
              })
              return
            }
            dispatch({ type: "selection/set", selection: { kind: "none" } })
          }}
          onNodeDrag={(_, draggedNode) => {
            if (!canEdit) return
            setNodes((current) => current.map((node) => node.id === draggedNode.id ? { ...node, position: { ...draggedNode.position } } : node))
          }}
          onNodeDragStop={(_, draggedNode) => {
            if (!canEdit) return
            if (draggedNode.type === "annotation") {
              dispatch({ type: "annotation/position-commit", annotationId: draggedNode.id, position: { ...draggedNode.position } })
            } else {
              dispatch({ type: "node/position-commit", nodeId: draggedNode.id, position: { ...draggedNode.position } })
            }
          }}
        >
          <FitViewAfterLayout layoutKey={layoutKey} />
          <Background color="#303030" gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap nodeColor={minimapNodeColor} pannable zoomable />
        </ReactFlow>
        {pendingConnection && (
          <ConnectionLabelDialog
            disabled={!canConnect}
            onCancel={() => setPendingConnection(null)}
            onConfirm={(label) => {
              commitConnection(pendingConnection.source, pendingConnection.target, label)
              setPendingConnection(null)
            }}
          />
        )}
      </div>
    </section>
  )
}

export default WorkflowEditorCanvas
