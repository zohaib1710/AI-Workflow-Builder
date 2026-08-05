import type {
  ApiErrorDetail,
  ApiErrorResponse,
  GenerateWorkflowRequest,
  GenerateWorkflowResponse,
} from "../types/workflow"

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"
).replace(/\/+$/, "")

export class WorkflowApiError extends Error {
  readonly status: number | null
  readonly code: string
  readonly field: string | null

  constructor(
    message: string,
    code: string,
    status: number | null,
    field: string | null,
  ) {
    super(message)
    this.name = "WorkflowApiError"
    this.status = status
    this.code = code
    this.field = field
  }
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { detail?: unknown; errors?: unknown }
  return typeof candidate.detail === "string" && Array.isArray(candidate.errors)
}

function isGeneratedWorkflowResponse(value: unknown): value is GenerateWorkflowResponse {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { workflow?: unknown; generation?: unknown }
  return typeof candidate.workflow === "object" && candidate.workflow !== null &&
    typeof candidate.generation === "object" && candidate.generation !== null
}

function errorForStatus(status: number): WorkflowApiError {
  if (status === 422) {
    return new WorkflowApiError("The workflow prompt is invalid.", "invalid_request", status, "prompt")
  }
  return new WorkflowApiError("Workflow generation failed.", "request_failed", status, null)
}

export async function generateWorkflow(
  request: GenerateWorkflowRequest,
  options?: { signal?: AbortSignal },
): Promise<GenerateWorkflowResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/workflows/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: request.prompt }),
      signal: options?.signal,
    })

    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }

    if (!response.ok) {
      if (!isApiErrorResponse(body)) throw errorForStatus(response.status)
      const firstError = body.errors.find(
        (error) => typeof error === "object" && error !== null &&
          typeof (error as ApiErrorDetail).message === "string",
      )
      throw new WorkflowApiError(
        firstError?.message ?? body.detail,
        firstError?.code ?? "request_failed",
        response.status,
        firstError?.field ?? null,
      )
    }

    if (!isGeneratedWorkflowResponse(body)) {
      throw new WorkflowApiError(
        "The backend returned an invalid response.",
        "invalid_response",
        response.status,
        null,
      )
    }
    return body
  } catch (error: unknown) {
    if (error instanceof WorkflowApiError) throw error
    throw new WorkflowApiError("The backend could not be reached.", "backend_unavailable", null, null)
  }
}
