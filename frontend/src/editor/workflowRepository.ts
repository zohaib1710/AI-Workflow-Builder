import { supabase } from "../lib/supabase"
import type { Workflow } from "../types/workflow"
import type { CanvasAnnotation, CanvasNodePresentation, EditorSnapshot, FlowchartShape } from "./types"

const nodeTypes = new Set(["start", "end", "trigger", "action", "decision", "api", "database", "wait", "approval", "notification"])
const shapes = new Set<FlowchartShape>(["terminator", "process", "decision", "input-output", "database", "document", "delay", "predefined-process", "manual-operation"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function isPosition(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y)
}

export function isWorkflow(value: unknown): value is Workflow {
  if (!isRecord(value) || typeof value.title !== "string" || typeof value.description !== "string" || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return false
  const ids = new Set<string>()
  for (const node of value.nodes) {
    if (!isRecord(node) || typeof node.id !== "string" || !node.id || ids.has(node.id) || !nodeTypes.has(String(node.type)) || typeof node.title !== "string" || typeof node.description !== "string" || (node.application !== null && typeof node.application !== "string")) return false
    ids.add(node.id)
  }
  const edgeIds = new Set<string>()
  for (const edge of value.edges) {
    if (!isRecord(edge) || typeof edge.id !== "string" || !edge.id || edgeIds.has(edge.id) || typeof edge.source !== "string" || typeof edge.target !== "string" || !ids.has(edge.source) || !ids.has(edge.target) || (edge.label !== null && typeof edge.label !== "string")) return false
    edgeIds.add(edge.id)
  }
  return true
}

export function parseSavedWorkflow(workflowId: string, version: unknown): SavedWorkflow {
  if (!isRecord(version) || !Number.isInteger(version.version_number) || Number(version.version_number) < 1 || !isWorkflow(version.semantic_workflow)) throw new Error("This saved workflow version contains invalid workflow data.")
  const presentation = version.presentation_state
  if (!isRecord(presentation) || !isRecord(presentation.nodePresentations) || !Array.isArray(presentation.annotations)) throw new Error("This saved workflow version is missing its canvas layout data.")
  const workflow = version.semantic_workflow
  const nodePresentations: Record<string, CanvasNodePresentation> = {}
  for (const node of workflow.nodes) {
    const item = presentation.nodePresentations[node.id]
    if (!isRecord(item) || item.nodeId !== node.id || !shapes.has(item.shape as FlowchartShape) || !isPosition(item.position) || (item.color !== undefined && (typeof item.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(item.color)))) throw new Error("This saved workflow version contains invalid canvas layout data.")
    nodePresentations[node.id] = { nodeId: node.id, shape: item.shape as FlowchartShape, position: { x: item.position.x, y: item.position.y }, ...(typeof item.color === "string" ? { color: item.color } : {}) }
  }
  if (Object.keys(presentation.nodePresentations).length !== workflow.nodes.length) throw new Error("This saved workflow version contains unexpected canvas layout data.")
  const annotations: CanvasAnnotation[] = []
  const annotationIds = new Set<string>()
  for (const item of presentation.annotations) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || annotationIds.has(item.id) || typeof item.text !== "string" || !isPosition(item.position)) throw new Error("This saved workflow version contains invalid text annotations.")
    annotationIds.add(item.id)
    annotations.push({ id: item.id, text: item.text, position: { x: item.position.x, y: item.position.y } })
  }
  return { id: workflowId, workflow, nodePresentations, annotations, versionNumber: Number(version.version_number) }
}

export interface OwnedWorkflowSummary {
  id: string
  title: string
  description: string
  updatedAt: string
}

export interface WorkflowVersionSummary {
  versionNumber: number
  name: string
  createdAt: string
}

export interface WorkflowRenameResult {
  versionNumber: number
  updatedAt: string
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

export function parseWorkflowVersionSummary(value: unknown): WorkflowVersionSummary {
  if (!isRecord(value) || !Number.isInteger(value.version_number) || Number(value.version_number) < 1 || !isValidTimestamp(value.created_at) || (value.change_summary !== null && typeof value.change_summary !== "string")) {
    throw new Error("Saved version details are invalid.")
  }
  const versionNumber = Number(value.version_number)
  return { versionNumber, name: (value.change_summary as string | null)?.trim() || `Version ${versionNumber}`, createdAt: value.created_at }
}

export async function listWorkflowVersions(workflowId: string): Promise<WorkflowVersionSummary[]> {
  const { data, error } = await supabase.from("workflow_versions").select("version_number, change_summary, created_at").eq("workflow_id", workflowId).order("version_number", { ascending: false })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error("The saved version list could not be read.")
  return data.map(parseWorkflowVersionSummary)
}

export async function loadWorkflowVersion(workflowId: string, versionNumber: number): Promise<SavedWorkflow | null> {
  const { data, error } = await supabase.from("workflow_versions").select("version_number, semantic_workflow, presentation_state").eq("workflow_id", workflowId).eq("version_number", versionNumber).maybeSingle()
  if (error) throw error
  if (!data) return null
  return parseSavedWorkflow(workflowId, data)
}

export async function renameWorkflow(workflowId: string, title: string): Promise<WorkflowRenameResult> {
  const normalizedTitle = title.trim()
  if (!normalizedTitle || normalizedTitle.length > 100) throw new Error("Workflow names must be between 1 and 100 characters.")
  const { data, error } = await supabase.rpc("rename_owned_workflow", { p_workflow_id: workflowId, p_new_title: normalizedTitle })
  if (error) throw error
  if (!isRecord(data) || !Number.isInteger(data.version_number) || Number(data.version_number) < 1 || !isValidTimestamp(data.updated_at)) throw new Error("Workflow rename returned invalid confirmation data.")
  return { versionNumber: Number(data.version_number), updatedAt: data.updated_at }
}

export async function listOwnedWorkflows(userId: string): Promise<OwnedWorkflowSummary[]> {
  const { data, error } = await supabase.from("workflows").select("id, title, description, updated_at").eq("owner_id", userId).order("updated_at", { ascending: false })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error("The saved workflow list could not be read.")
  return data.map((row: Record<string, unknown>) => {
    if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.description !== "string" || typeof row.updated_at !== "string") throw new Error("The saved workflow list contains invalid data.")
    return { id: row.id, title: row.title, description: row.description, updatedAt: row.updated_at }
  })
}

export async function createWorkflowRecord(userId: string, snapshot: EditorSnapshot) {
  const { data: workflow, error: workflowError } = await supabase.from("workflows").insert({ owner_id: userId, title: snapshot.workflow.title, description: snapshot.workflow.description }).select("id").single()
  if (workflowError) throw workflowError
  const { error: versionError } = await supabase.from("workflow_versions").insert({ workflow_id: workflow.id, version_number: 1, created_by: userId, semantic_workflow: snapshot.workflow, presentation_state: { nodePresentations: snapshot.nodePresentations, annotations: snapshot.annotations }, change_summary: "Initial workflow" })
  if (versionError) {
    await supabase.from("workflows").delete().eq("id", workflow.id)
    throw versionError
  }
  return workflow.id as string
}

export async function saveWorkflowVersion(userId: string, workflowId: string, snapshot: EditorSnapshot, versionName?: string) {
  const { data: latest, error: latestError } = await supabase.from("workflow_versions").select("version_number").eq("workflow_id", workflowId).order("version_number", { ascending: false }).limit(1).maybeSingle()
  if (latestError) throw latestError
  const nextVersion = (latest?.version_number ?? 0) + 1
  const { error: versionError } = await supabase.from("workflow_versions").insert({ workflow_id: workflowId, version_number: nextVersion, created_by: userId, semantic_workflow: snapshot.workflow, presentation_state: { nodePresentations: snapshot.nodePresentations, annotations: snapshot.annotations }, change_summary: versionName?.trim() || `Version ${nextVersion}` })
  if (versionError) throw versionError
  const { error: workflowError } = await supabase.from("workflows").update({ title: snapshot.workflow.title, description: snapshot.workflow.description, updated_at: new Date().toISOString() }).eq("id", workflowId)
  if (workflowError) throw workflowError
  return nextVersion
}

export interface SavedWorkflow {
  id: string
  workflow: Workflow
  nodePresentations: EditorSnapshot["nodePresentations"]
  annotations: EditorSnapshot["annotations"]
  versionNumber: number
}

export async function loadLatestWorkflow(workflowId: string): Promise<SavedWorkflow | null> {
  const { data, error } = await supabase.from("workflow_versions").select("version_number, semantic_workflow, presentation_state").eq("workflow_id", workflowId).order("version_number", { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  if (!data) return null
  return parseSavedWorkflow(workflowId, data)
}
