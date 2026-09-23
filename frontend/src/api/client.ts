import type {
  ApiErrorDetail,
  EditWorkflowRequest,
  EditWorkflowResponse,
  GenerateWorkflowRequest,
  GenerateWorkflowResponse,
} from "../types/workflow"

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "/api/v1"
).replace(/\/+$/, "")

export const API_REQUEST_TIMEOUT_MS = 30_000

const SUPPORTED_NODE_TYPES = new Set([
  "start", "end", "trigger", "action", "decision", "api", "database", "wait", "approval", "notification",
])

const SAFE_BACKEND_ERROR_MESSAGES = {
  invalid_request: "Check the workflow prompt and try again.",
  invalid_edit_workflow: "The current workflow is not valid for editing.",
  invalid_edit_output: "The workflow could not be revised in a valid format. Please try again.",
  invalid_provider_output: "The workflow could not be generated in a valid format. Please try again.",
  provider_not_configured: "Workflow generation is temporarily unavailable.",
  provider_credentials_unavailable: "Workflow generation is temporarily unavailable.",
  provider_rate_limited: "Workflow generation is busy right now. Please try again shortly.",
  provider_timeout: "Workflow generation timed out. Please try again.",
  provider_unavailable: "The workflow generation service is unavailable. Please try again.",
  provider_api_error: "Workflow generation failed. Please try again.",
  provider_response_invalid: "The workflow generation service returned an invalid response.",
  internal_error: "Something went wrong while generating the workflow. Please try again.",
} as const

export class WorkflowApiError extends Error {
  readonly status: number | null
  readonly code: string
  readonly field: string | null

  constructor(message: string, code: string, status: number | null, field: string | null) {
    super(message)
    this.name = "WorkflowApiError"
    this.status = status
    this.code = code
    this.field = field
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isApiErrorDetail(value: unknown): value is ApiErrorDetail {
  if (!isRecord(value)) return false
  return typeof value.code === "string" && typeof value.message === "string" && isNullableString(value.field)
}

function isWorkflowNode(value: unknown): boolean {
  if (!isRecord(value)) return false
  return typeof value.id === "string" && typeof value.type === "string" &&
    SUPPORTED_NODE_TYPES.has(value.type) && typeof value.title === "string" &&
    typeof value.description === "string" && isNullableString(value.application)
}

function isWorkflowEdge(value: unknown): boolean {
  if (!isRecord(value)) return false
  return typeof value.id === "string" && typeof value.source === "string" &&
    typeof value.target === "string" && isNullableString(value.label)
}

type WorkflowResponse = GenerateWorkflowResponse | EditWorkflowResponse

function isWorkflowResponse(value: unknown): value is WorkflowResponse {
  if (!isRecord(value) || !isRecord(value.workflow) || !isRecord(value.generation)) return false
  const { workflow, generation } = value
  return typeof workflow.title === "string" && typeof workflow.description === "string" &&
    Array.isArray(workflow.nodes) && workflow.nodes.every(isWorkflowNode) &&
    Array.isArray(workflow.edges) && workflow.edges.every(isWorkflowEdge) &&
    typeof generation.model === "string" &&
    typeof generation.durationMs === "number" && Number.isFinite(generation.durationMs) &&
    generation.durationMs >= 0
}

function errorForStatus(status: number): WorkflowApiError {
  if (status === 422) {
    return new WorkflowApiError(SAFE_BACKEND_ERROR_MESSAGES.invalid_request, "invalid_request", status, "prompt")
  }
  return new WorkflowApiError(
    "Workflow generation failed. Please try again.", "invalid_error_response", status, null,
  )
}

function errorFromResponseBody(body: unknown, status: number): WorkflowApiError {
  if (!isRecord(body) || typeof body.detail !== "string" || !Array.isArray(body.errors)) {
    return errorForStatus(status)
  }
  const detail = body.errors.find(isApiErrorDetail)
  if (!detail || !(detail.code in SAFE_BACKEND_ERROR_MESSAGES)) return errorForStatus(status)

  const code = detail.code as keyof typeof SAFE_BACKEND_ERROR_MESSAGES
  return new WorkflowApiError(SAFE_BACKEND_ERROR_MESSAGES[code], code, status, detail.field)
}

async function postWorkflowRequest<TResponse extends WorkflowResponse>(
  path: string,
  payload: object,
  options?: { signal?: AbortSignal },
): Promise<TResponse> {
  const controller = new AbortController()
  let didTimeout = false
  const timeoutId = globalThis.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, API_REQUEST_TIMEOUT_MS)
  const abortFromExternalSignal = () => controller.abort()
  options?.signal?.addEventListener("abort", abortFromExternalSignal, { once: true })

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }

    if (!response.ok) throw errorFromResponseBody(body, response.status)
    if (!isWorkflowResponse(body)) {
      throw new WorkflowApiError(
        "The backend returned an invalid workflow response.", "invalid_response", response.status, null,
      )
    }
    return body as TResponse
  } catch (error: unknown) {
    if (error instanceof WorkflowApiError) throw error
    if (didTimeout) {
      throw new WorkflowApiError("The request timed out. Please try again.", "request_timeout", null, null)
    }
    throw new WorkflowApiError(
      "The backend could not be reached. Check your connection and try again.", "network_error", null, null,
    )
  } finally {
    globalThis.clearTimeout(timeoutId)
    options?.signal?.removeEventListener("abort", abortFromExternalSignal)
  }
}

export function generateWorkflow(
  request: GenerateWorkflowRequest,
  options?: { signal?: AbortSignal },
): Promise<GenerateWorkflowResponse> {
  return postWorkflowRequest(
    "/workflows/generate",
    { prompt: request.prompt },
    options,
  )
}

export function editWorkflow(
  request: EditWorkflowRequest,
  options?: { signal?: AbortSignal },
): Promise<EditWorkflowResponse> {
  return postWorkflowRequest(
    "/workflows/edit",
    { instruction: request.instruction, workflow: request.workflow },
    options,
  )
}
