import type { NodeTypes, Edge, Node } from "@xyflow/react"
import type { SupportedNodeType } from "../../types/workflow"
import WorkflowNode from "./WorkflowNode"

export interface WorkflowNodeData extends Record<string, unknown> {
  nodeType: SupportedNodeType
  title: string
  description: string
  application: string | null
}

export type WorkflowFlowNode = Node<WorkflowNodeData, SupportedNodeType>
export type WorkflowFlowEdge = Edge

export const supportedNodeTypes: readonly SupportedNodeType[] = [
  "start", "end", "trigger", "action", "decision", "api", "database", "wait", "approval", "notification",
]

export const workflowNodeTypes = {
  start: WorkflowNode,
  end: WorkflowNode,
  trigger: WorkflowNode,
  action: WorkflowNode,
  decision: WorkflowNode,
  api: WorkflowNode,
  database: WorkflowNode,
  wait: WorkflowNode,
  approval: WorkflowNode,
  notification: WorkflowNode,
} satisfies NodeTypes

export interface WorkflowVisualConfig {
  label: string
  symbol: string
  accentClass: string
  badgeClass: string
  minimapColor: string
}

export const workflowVisualConfig: Record<SupportedNodeType, WorkflowVisualConfig> = {
  start: { label: "Start", symbol: "▶", accentClass: "workflow-node--start", badgeClass: "workflow-badge--start", minimapColor: "#16a34a" },
  end: { label: "End", symbol: "■", accentClass: "workflow-node--end", badgeClass: "workflow-badge--end", minimapColor: "#334155" },
  trigger: { label: "Trigger", symbol: "⚡", accentClass: "workflow-node--trigger", badgeClass: "workflow-badge--trigger", minimapColor: "#d97706" },
  action: { label: "Action", symbol: "◆", accentClass: "workflow-node--action", badgeClass: "workflow-badge--action", minimapColor: "#2563eb" },
  decision: { label: "Decision", symbol: "?", accentClass: "workflow-node--decision", badgeClass: "workflow-badge--decision", minimapColor: "#7c3aed" },
  api: { label: "API", symbol: "⇄", accentClass: "workflow-node--api", badgeClass: "workflow-badge--api", minimapColor: "#0891b2" },
  database: { label: "Database", symbol: "▤", accentClass: "workflow-node--database", badgeClass: "workflow-badge--database", minimapColor: "#4f46e5" },
  wait: { label: "Wait", symbol: "◷", accentClass: "workflow-node--wait", badgeClass: "workflow-badge--wait", minimapColor: "#ea580c" },
  approval: { label: "Approval", symbol: "✓", accentClass: "workflow-node--approval", badgeClass: "workflow-badge--approval", minimapColor: "#db2777" },
  notification: { label: "Notification", symbol: "✉", accentClass: "workflow-node--notification", badgeClass: "workflow-badge--notification", minimapColor: "#0d9488" },
}

export function isSupportedNodeType(value: string): value is SupportedNodeType {
  return supportedNodeTypes.includes(value as SupportedNodeType)
}
