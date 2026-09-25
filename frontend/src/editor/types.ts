import type { SupportedNodeType, Workflow } from "../types/workflow"

export type FlowchartShape =
  | "terminator"
  | "process"
  | "decision"
  | "input-output"
  | "database"
  | "document"
  | "delay"
  | "predefined-process"
  | "manual-operation"

export const DEFAULT_SHAPE_BY_NODE_TYPE = {
  start: "terminator",
  end: "terminator",
  trigger: "terminator",
  action: "process",
  decision: "decision",
  api: "process",
  database: "database",
  wait: "delay",
  approval: "decision",
  notification: "document",
} as const satisfies Record<SupportedNodeType, FlowchartShape>

export interface CanvasPosition { x: number; y: number }

export interface CanvasNodePresentation {
  nodeId: string
  shape: FlowchartShape
  color?: string
  position: CanvasPosition
}

export interface CanvasAnnotation {
  id: string
  text: string
  position: CanvasPosition
}

export type EditorSelection =
  | { kind: "none" }
  | { kind: "node"; nodeId: string }
  | { kind: "edge"; edgeId: string }
  | { kind: "annotation"; annotationId: string }

export type EditorTool = "select" | "shape" | "text"

export const NODE_CREATION_PRESETS = [
  { id: "start", label: "Start", semanticType: "start", shape: "terminator" },
  { id: "end", label: "End", semanticType: "end", shape: "terminator" },
  { id: "trigger", label: "Trigger", semanticType: "trigger", shape: "terminator" },
  { id: "process", label: "Process", semanticType: "action", shape: "process" },
  { id: "decision", label: "Decision", semanticType: "decision", shape: "decision" },
  { id: "approval", label: "Approval", semanticType: "approval", shape: "decision" },
  { id: "input-output", label: "Input / Output", semanticType: "api", shape: "input-output" },
  { id: "database", label: "Database", semanticType: "database", shape: "database" },
  { id: "document", label: "Document", semanticType: "notification", shape: "document" },
  { id: "delay", label: "Delay", semanticType: "wait", shape: "delay" },
  { id: "predefined-process", label: "Predefined Process", semanticType: "action", shape: "predefined-process" },
  { id: "manual-operation", label: "Manual Operation", semanticType: "action", shape: "manual-operation" },
] as const satisfies readonly {
  id: string
  label: string
  semanticType: SupportedNodeType
  shape: FlowchartShape
}[]

export type NodeCreationPreset = (typeof NODE_CREATION_PRESETS)[number]
export type NodeCreationPresetId = NodeCreationPreset["id"]

export const NODE_CREATION_PRESETS_BY_ID = Object.fromEntries(
  NODE_CREATION_PRESETS.map((preset) => [preset.id, preset]),
) as Record<NodeCreationPresetId, NodeCreationPreset>

export type EditorAsyncState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }

export interface EditorSnapshot {
  workflow: Workflow
  nodePresentations: Record<string, CanvasNodePresentation>
  annotations: CanvasAnnotation[]
}

export type EditorValidationIssueCode =
  | "duplicate_node_id"
  | "duplicate_edge_id"
  | "missing_source_node"
  | "missing_target_node"
  | "self_referencing_edge"
  | "start_node_has_incoming_edge"
  | "end_node_has_outgoing_edge"
  | "decision_requires_multiple_paths"
  | "decision_edge_label_required"
  | "disconnected_graph"

export interface EditorValidationIssue {
  code: EditorValidationIssueCode
  message: string
  nodeId?: string
  edgeId?: string
}

export interface EditorState {
  past: EditorSnapshot[]
  present: EditorSnapshot
  future: EditorSnapshot[]
  selection: EditorSelection
  activeTool: EditorTool
  pendingNodePreset: NodeCreationPresetId | null
  asyncState: EditorAsyncState
  issues: EditorValidationIssue[]
}
