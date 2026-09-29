import { supabase } from "../lib/supabase"
import type { Workflow } from "../types/workflow"
import type { EditorSnapshot } from "./types"

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

export async function saveWorkflowVersion(userId: string, workflowId: string, snapshot: EditorSnapshot) {
  const { data: latest, error: latestError } = await supabase.from("workflow_versions").select("version_number").eq("workflow_id", workflowId).order("version_number", { ascending: false }).limit(1).maybeSingle()
  if (latestError) throw latestError
  const nextVersion = (latest?.version_number ?? 0) + 1
  const { error: versionError } = await supabase.from("workflow_versions").insert({ workflow_id: workflowId, version_number: nextVersion, created_by: userId, semantic_workflow: snapshot.workflow, presentation_state: { nodePresentations: snapshot.nodePresentations, annotations: snapshot.annotations }, change_summary: "Manual save" })
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
  const presentation = (data.presentation_state ?? {}) as Partial<Pick<EditorSnapshot, "nodePresentations" | "annotations">>
  return { id: workflowId, workflow: data.semantic_workflow as Workflow, nodePresentations: presentation.nodePresentations ?? {}, annotations: presentation.annotations ?? [], versionNumber: data.version_number }
}