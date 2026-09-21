export type SupportedNodeType =
  | "start"
  | "end"
  | "trigger"
  | "action"
  | "decision"
  | "api"
  | "database"
  | "wait"
  | "approval"
  | "notification"

export interface WorkflowNode {
  id: string
  type: SupportedNodeType
  title: string
  description: string
  application: string | null
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  label: string | null
}

export interface Workflow {
  title: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  assumptions: string[]
  missingRequirements: string[]
  suggestions: string[]
}

export interface GenerationMetadata {
  model: string
  durationMs: number
}

export interface GenerateWorkflowRequest {
  prompt: string
}

export interface GenerateWorkflowResponse {
  workflow: Workflow
  generation: GenerationMetadata
}

export interface EditWorkflowRequest {
  instruction: string
  workflow: Workflow
}

export interface EditWorkflowResponse {
  workflow: Workflow
  generation: GenerationMetadata
}

export interface ApiErrorDetail {
  code: string
  message: string
  field: string | null
}

export interface ApiErrorResponse {
  detail: string
  errors: ApiErrorDetail[]
}
