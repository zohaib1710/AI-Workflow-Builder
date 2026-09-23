import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { API_REQUEST_TIMEOUT_MS, generateWorkflow, WorkflowApiError } from "../api/client"
import type { GenerateWorkflowResponse } from "../types/workflow"

const fetchMock = vi.fn()

function validResponse(): GenerateWorkflowResponse {
  return {
    workflow: {
      title: "Lead workflow",
      description: "Qualifies incoming leads.",
      nodes: [{ id: "start", type: "start", title: "Receive lead", description: "A lead arrives.", application: null }],
      edges: [],
    },
    generation: { model: "test-model", durationMs: 25 },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

async function captureApiError(promise: Promise<unknown>): Promise<WorkflowApiError> {
  try {
    await promise
  } catch (error: unknown) {
    if (error instanceof WorkflowApiError) return error
    throw error
  }
  throw new Error("Expected generateWorkflow to reject")
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("generateWorkflow", () => {
  it("posts exactly the prompt to the configured workflow endpoint", async () => {
    const payload = validResponse()
    fetchMock.mockResolvedValue(jsonResponse(payload))

    await expect(generateWorkflow({ prompt: "Create a lead workflow" })).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const expectedBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "")
    expect(url).toBe(`${expectedBaseUrl}/workflows/generate`)
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({ "Content-Type": "application/json" })
    expect(init.body).toBe(JSON.stringify({ prompt: "Create a lead workflow" }))
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    ["invalid_request", "Check the workflow prompt and try again."],
    ["provider_timeout", "Workflow generation timed out. Please try again."],
    ["provider_rate_limited", "Workflow generation is busy right now. Please try again shortly."],
    ["provider_credentials_unavailable", "Workflow generation is temporarily unavailable."],
    ["provider_unavailable", "The workflow generation service is unavailable. Please try again."],
  ])("maps the %s backend error to a controlled message", async (code, expectedMessage) => {
    fetchMock.mockResolvedValue(jsonResponse({
      detail: "Bearer secret at provider.example via httpx",
      errors: [{ code, message: "credential=sk-test-secret traceback", field: null }],
    }, 503))

    const error = await captureApiError(generateWorkflow({ prompt: "Create a workflow" }))
    expect(error.code).toBe(code)
    expect(error.message).toBe(expectedMessage)
    expect(error.message).not.toMatch(/Bearer|secret|Groq|httpx|traceback|API_KEY/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("normalizes network failures without exposing the browser error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch provider.example with Bearer secret"))

    const error = await captureApiError(generateWorkflow({ prompt: "Create a workflow" }))
    expect(error.code).toBe("network_error")
    expect(error.message).toBe("The backend could not be reached. Check your connection and try again.")
    expect(error.message).not.toMatch(/Failed to fetch|Bearer|groq/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("aborts once at the request timeout without another request", async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"))
        })
      })
    ))

    const rejection = captureApiError(generateWorkflow({ prompt: "Create a workflow" }))
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS)
    const error = await rejection
    expect(error.code).toBe("request_timeout")
    expect(error.message).toBe("The request timed out. Please try again.")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["HTML", new Response("<html>Bearer secret</html>", { status: 502 })],
    ["plain text", new Response("httpx traceback", { status: 500 })],
    ["empty", new Response(null, { status: 503 })],
  ])("normalizes a non-JSON %s error response", async (_label, response) => {
    fetchMock.mockResolvedValue(response)

    const error = await captureApiError(generateWorkflow({ prompt: "Create a workflow" }))
    expect(error.code).toBe("invalid_error_response")
    expect(error.message).toBe("Workflow generation failed. Please try again.")
    expect(error.message).not.toMatch(/html|Bearer|httpx|traceback/i)
  })

  it.each([
    ["malformed JSON", () => new Response("{", { status: 200, headers: { "Content-Type": "application/json" } })],
    ["missing workflow", () => jsonResponse({ generation: validResponse().generation })],
    ["missing generation", () => jsonResponse({ workflow: validResponse().workflow })],
    ["invalid duration", () => jsonResponse({ ...validResponse(), generation: { model: "test", durationMs: -1 } })],
    ["unsupported node", () => jsonResponse({
      ...validResponse(),
      workflow: { ...validResponse().workflow, nodes: [{ ...validResponse().workflow.nodes[0], type: "unknown" }] },
    })],
    ["invalid edge", () => jsonResponse({
      ...validResponse(),
      workflow: {
        ...validResponse().workflow,
        edges: [{ id: "edge", source: "start", target: 7, label: null }],
      },
    })],
  ])("rejects a successful response with %s", async (_label, responseFactory) => {
    fetchMock.mockResolvedValue(responseFactory())

    const error = await captureApiError(generateWorkflow({ prompt: "Create a workflow" }))
    expect(error.code).toBe("invalid_response")
    expect(error.message).toBe("The backend returned an invalid workflow response.")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not propagate unknown error envelopes or secret-like values", async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      detail: "Authorization: Bearer key",
      errors: [{ code: "raw_provider_failure", message: "credential=sk-test-secret provider.example", field: null }],
    }, 502))

    const error = await captureApiError(generateWorkflow({ prompt: "Create a workflow" }))
    expect(error.code).toBe("invalid_error_response")
    expect(error.message).toBe("Workflow generation failed. Please try again.")
    expect(error.message).not.toMatch(/Authorization|Bearer|API_KEY|openai/i)
  })

  it("clears the timeout after both success and failure", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")
    fetchMock.mockResolvedValueOnce(jsonResponse(validResponse()))
    await generateWorkflow({ prompt: "First workflow" })

    fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    await captureApiError(generateWorkflow({ prompt: "Second workflow" }))
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
  })
})
