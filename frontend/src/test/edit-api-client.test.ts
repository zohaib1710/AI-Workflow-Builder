import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { API_REQUEST_TIMEOUT_MS, editWorkflow, WorkflowApiError } from "../api/client"
import type { EditWorkflowResponse, Workflow } from "../types/workflow"

const fetchMock = vi.fn()

function workflowFixture(): Workflow {
  return {
    title: "Lead workflow",
    description: "Qualifies incoming leads.",
    nodes: [
      {
        id: "start",
        type: "start",
        title: "Receive lead",
        description: "A lead arrives.",
        application: null,
      },
    ],
    edges: [],
    assumptions: ["The CRM is available."],
    missingRequirements: [],
    suggestions: ["Review routing monthly."],
  }
}

function validResponse(): EditWorkflowResponse {
  return {
    workflow: { ...workflowFixture(), title: "Revised lead workflow" },
    generation: { model: "test-model", durationMs: 18 },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

async function captureApiError(promise: Promise<unknown>): Promise<WorkflowApiError> {
  try {
    await promise
  } catch (error: unknown) {
    if (error instanceof WorkflowApiError) return error
    throw error
  }
  throw new Error("Expected editWorkflow to reject")
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

describe("editWorkflow", () => {
  it("posts exactly the instruction and semantic workflow and validates success", async () => {
    const response = validResponse()
    const workflow = workflowFixture()
    fetchMock.mockResolvedValue(jsonResponse(response))

    await expect(editWorkflow({ instruction: "Rename it.", workflow })).resolves.toEqual(response)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const baseUrl = (
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"
    ).replace(/\/+$/, "")
    expect(url).toBe(`${baseUrl}/workflows/edit`)
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ instruction: "Rename it.", workflow }))
    expect(Object.keys(JSON.parse(String(init.body)))).toEqual(["instruction", "workflow"])
  })

  it("returns a controlled timeout error without retrying", async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"))
        })
      })
    ))

    const rejection = captureApiError(
      editWorkflow({ instruction: "Rename it.", workflow: workflowFixture() }),
    )
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS)

    await expect(rejection).resolves.toMatchObject({ code: "request_timeout" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("normalizes a network error without retrying", async () => {
    fetchMock.mockRejectedValue(new TypeError("Bearer secret at provider.example"))

    const error = await captureApiError(
      editWorkflow({ instruction: "Rename it.", workflow: workflowFixture() }),
    )

    expect(error.code).toBe("network_error")
    expect(error.message).not.toMatch(/Bearer|secret|provider\.example/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["non-JSON success", () => new Response("<html>secret</html>", { status: 200 })],
    ["missing response fields", () => jsonResponse({ workflow: workflowFixture() })],
  ])("rejects a %s with a controlled error", async (_label, responseFactory) => {
    fetchMock.mockResolvedValue(responseFactory())

    const error = await captureApiError(
      editWorkflow({ instruction: "Rename it.", workflow: workflowFixture() }),
    )

    expect(error.code).toBe("invalid_response")
    expect(error.message).toBe("The backend returned an invalid workflow response.")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
