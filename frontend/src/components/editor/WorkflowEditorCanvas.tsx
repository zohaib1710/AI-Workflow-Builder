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
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import { createUniqueEditorId } from "../../editor/ids"
import { findNearestClearNodePosition } from "../../editor/nodePlacement"
import { DEFAULT_SHAPE_BY_NODE_TYPE, NODE_CREATION_PRESETS_BY_ID } from "../../editor/types"
import useEditorShortcuts from "../../hooks/useEditorShortcuts"
import { isSupportedNodeType, workflowVisualConfig } from "../nodes/nodeTypes"
import ConnectionLabelDialog from "./ConnectionLabelDialog"
import { annotationNodeTypes, type AnnotationFlowNode, type AnnotationNodeData } from "./nodes/AnnotationNode"
import { flowchartNodeTypes, type FlowchartFlowNode, type FlowchartNodeData } from "./nodes/FlowchartNode"
import { FLOWCHART_SHAPES } from "./nodes/shapeRegistry"

export interface WorkflowEditorCanvasProps {
  editingViewport: boolean
}

export const AUTO_ARRANGE_FIT_EVENT = "workflow-editor:auto-arrange-fit"

type EditorFlowNode = FlowchartFlowNode | AnnotationFlowNode
const editorNodeTypes = { ...flowchartNodeTypes, ...annotationNodeTypes }
const editorFitPadding = { top: "88px", right: "224px", bottom: "208px", left: "80px" } as const
const initialFitViewOptions = { padding: editorFitPadding, minZoom: 0.2, maxZoom: 1.2 }
const arrangedFitViewOptions = { padding: editorFitPadding, minZoom: 0.2, maxZoom: 1.25, duration: 200 }
const fullscreenFitViewOptions = { padding: 0.08, minZoom: 0.05, maxZoom: 1, duration: 200 }
const reactFlowOptions = { hideAttribution: true }

function isFullscreenViewport(): boolean {
  if (document.fullscreenElement) return true
  return Math.abs(window.innerWidth - window.screen.width) <= 1
    && Math.abs(window.innerHeight - window.screen.height) <= 1
}

function FitViewAfterLayout() {
  const nodesInitialized = useNodesInitialized()
  const { fitView } = useReactFlow()
  const hasFittedInitialWorkflow = useRef(false)

  useEffect(() => {
    if (!nodesInitialized || hasFittedInitialWorkflow.current) return
    hasFittedInitialWorkflow.current = true
    void fitView(arrangedFitViewOptions)
  }, [fitView, nodesInitialized])

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
  if (node.type === "flowchart" && typeof node.data.color === "string") return node.data.color
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
  const canConnect = canEdit
  const derivedNodes = useMemo<EditorFlowNode[]>(() => {
    if (!editorState || !workflow) return []
    const workflowNodes: FlowchartFlowNode[] = workflow.nodes.map((node, index) => {
      const presentation = editorState.present.nodePresentations[node.id]
      const shape = presentation?.shape ?? DEFAULT_SHAPE_BY_NODE_TYPE[node.type]
      return {
        id: node.id,
        type: "flowchart",
        position: presentation?.position ?? { x: 0, y: index * 190 },
        data: {
          nodeType: node.type,
          title: node.title,
          description: node.description,
          application: node.application,
          shape,
          color: presentation?.color ?? FLOWCHART_SHAPES[shape].defaultColor,
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
  const selectedEdgeId = editorState?.selection.kind === "edge" ? editorState.selection.edgeId : null
  const edges = useMemo(
    () => buildEdges(workflow?.edges ?? [], selectedEdgeId, canEdit),
    [canEdit, selectedEdgeId, workflow?.edges],
  )
  useEffect(() => {
    flowInstance?.setNodes(derivedNodes)
  }, [derivedNodes, flowInstance])
  useEffect(() => {
    const fitArrangedWorkflow = () => {
      globalThis.requestAnimationFrame(() => {
        void flowInstance?.fitView(arrangedFitViewOptions)
      })
    }
    window.addEventListener(AUTO_ARRANGE_FIT_EVENT, fitArrangedWorkflow)
    return () => window.removeEventListener(AUTO_ARRANGE_FIT_EVENT, fitArrangedWorkflow)
  }, [flowInstance])
  useEffect(() => {
    if (!flowInstance) return
    let wasFullscreen = isFullscreenViewport()
    let firstFrame: number | null = null
    let secondFrame: number | null = null

    const fitAfterFullscreenResize = () => {
      const isFullscreen = isFullscreenViewport()
      if (!isFullscreen || wasFullscreen) {
        wasFullscreen = isFullscreen
        return
      }
      wasFullscreen = true
      firstFrame = globalThis.requestAnimationFrame(() => {
        secondFrame = globalThis.requestAnimationFrame(() => {
          const workflowNodes = flowInstance.getNodes().filter(
            (node) => node.type === "flowchart" && !node.hidden,
          )
          if (workflowNodes.length > 0) {
            void flowInstance.fitView({ ...fullscreenFitViewOptions, nodes: workflowNodes })
          }
        })
      })
    }

    document.addEventListener("fullscreenchange", fitAfterFullscreenResize)
    window.addEventListener("resize", fitAfterFullscreenResize)
    return () => {
      document.removeEventListener("fullscreenchange", fitAfterFullscreenResize)
      window.removeEventListener("resize", fitAfterFullscreenResize)
      if (firstFrame !== null) globalThis.cancelAnimationFrame(firstFrame)
      if (secondFrame !== null) globalThis.cancelAnimationFrame(secondFrame)
    }
  }, [flowInstance])
  useEffect(() => {
    if (!canConnect) setPendingConnection(null)
  }, [canConnect])
  const cancelPendingInteraction = useCallback(() => {
    if (!pendingConnection) return false
    setPendingConnection(null)
    return true
  }, [pendingConnection])
  useEditorShortcuts({ editingViewport, cancelPendingInteraction })

  const handleNodeDragStop = useCallback((_: unknown, draggedNode: EditorFlowNode) => {
    if (!canEdit) return
    if (draggedNode.type === "annotation") {
      dispatch({ type: "annotation/position-commit", annotationId: draggedNode.id, position: { ...draggedNode.position } })
    } else {
      const presentation = editorState?.present.nodePresentations[draggedNode.id]
      if (!presentation) return
      const position = findNearestClearNodePosition(
        draggedNode.position,
        presentation.shape,
        editorState.present.nodePresentations,
        draggedNode.id,
      )
      dispatch({ type: "node/position-commit", nodeId: draggedNode.id, position })
    }
  }, [canEdit, dispatch, editorState])

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
          defaultNodes={derivedNodes}
          edges={edges}
          nodeTypes={editorNodeTypes}
          onInit={setFlowInstance}
          fitView
          fitViewOptions={initialFitViewOptions}
          minZoom={0.05}
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
          proOptions={reactFlowOptions}
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
              const requestedPosition = flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
              const nodeId = createUniqueEditorId("node", new Set(workflow.nodes.map((node) => node.id)))
              const preset = NODE_CREATION_PRESETS_BY_ID[editorState.pendingNodePreset]
              const position = findNearestClearNodePosition(
                requestedPosition,
                preset.shape,
                editorState.present.nodePresentations,
              )
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
          onNodeDragStop={handleNodeDragStop}
        >
          <FitViewAfterLayout />
          <Background color="#d1d5db" gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap position="bottom-right" nodeColor={minimapNodeColor} pannable zoomable />
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
