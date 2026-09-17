import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import App from "../App"
import { WorkflowApiError } from "../api/client"
import type { GenerateWorkflowResponse } from "../types/workflow"

const generateWorkflowMock = vi.hoisted(() => vi.fn())

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return { ...actual, generateWorkflow: generateWorkflowMock }
})

afterEach(() => {
  cleanup()
  generateWorkflowMock.mockReset()
})

function responseFixture(): GenerateWorkflowResponse {
  return {
    workflow: {
      title: "Lead qualification workflow",
      description: "Qualifies and routes incoming leads.",
      nodes: [
        { id: "start", type: "start", title: "Receive lead", description: "A lead arrives.", application: null },
        { id: "trigger", type: "trigger", title: "Check lead", description: "Start qualification.", application: "CRM" },
        { id: "decision", type: "decision", title: "Qualified?", description: "Evaluate the lead.", application: "CRM" },
        { id: "action", type: "action", title: "Assign lead", description: "Route to sales.", application: "CRM" },
        { id: "end", type: "end", title: "Finish", description: "Close the workflow.", application: null },
      ],
      edges: [
        { id: "start-trigger", source: "start", target: "trigger", label: null },
        { id: "trigger-decision", source: "trigger", target: "decision", label: null },
        { id: "decision-yes", source: "decision", target: "action", label: "Yes" },
        { id: "decision-no", source: "decision", target: "end", label: "No" },
        { id: "action-end", source: "action", target: "end", label: null },
      ],
      assumptions: ["The CRM is available."],
      missingRequirements: ["Define the qualification threshold."],
      suggestions: ["Review routing outcomes monthly."],
    },
    generation: { model: "test-model", durationMs: 25 },
  }
}

function enterPrompt(value = "  Create a lead qualification workflow  ") {
  fireEvent.change(screen.getByRole("textbox", { name: "Workflow prompt" }), {
    target: { value },
  })
}

function submitPrompt() {
  fireEvent.click(screen.getByRole("button", { name: "Generate Workflow" }))
}

describe("App workflow generation", () => {
  it("renders the initial page controls without a workflow result", () => {
    render(<App />)

    expect(screen.getByText("AI Workflow Builder")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate Workflow" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument()
    expect(screen.queryByText("Workflow result")).not.toBeInTheDocument()
  })

  it("submits the normalized prompt once and renders the generated result", async () => {
    generateWorkflowMock.mockResolvedValue(responseFixture())
    render(<App />)

    enterPrompt()
    submitPrompt()

    expect(generateWorkflowMock).toHaveBeenCalledTimes(1)
    expect(generateWorkflowMock).toHaveBeenCalledWith({ prompt: "Create a lead qualification workflow" })
    expect(await screen.findByRole("heading", { name: "Lead qualification workflow" })).toBeInTheDocument()
    expect(screen.getByText("The CRM is available.")).toBeInTheDocument()
    expect(screen.getByText("Define the qualification threshold.")).toBeInTheDocument()
    expect(screen.getByText("Review routing outcomes monthly.")).toBeInTheDocument()
  })

  it("shows loading, disables conflicting actions, and prevents duplicate submission", async () => {
    let resolveRequest!: (response: GenerateWorkflowResponse) => void
    generateWorkflowMock.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    render(<App />)

    enterPrompt("Create a workflow")
    submitPrompt()

    expect(await screen.findByRole("status")).toHaveTextContent("Generating workflow...")
    expect(screen.getByRole("button", { name: /Generating workflow/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled()
    fireEvent.submit(screen.getByRole("form", { name: "Describe your workflow" }))
    expect(generateWorkflowMock).toHaveBeenCalledTimes(1)

    resolveRequest(responseFixture())
    expect(await screen.findByRole("heading", { name: "Lead qualification workflow" })).toBeInTheDocument()
  })

  it("renders only the controlled failure message and clears the error", async () => {
    const error = new WorkflowApiError(
      "The workflow generation service is unavailable. Please try again.",
      "provider_unavailable",
      503,
      null,
    ) as WorkflowApiError & { internalDetail?: string }
    error.internalDetail = "SUPER_SECRET_TEST_VALUE"
    generateWorkflowMock.mockRejectedValue(error)
    render(<App />)

    enterPrompt("Create a workflow")
    submitPrompt()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The workflow generation service is unavailable. Please try again.",
    )
    expect(screen.queryByText("SUPER_SECRET_TEST_VALUE")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveValue("")
  })

  it("keeps a previous result after a failed regeneration and Clear removes all state", async () => {
    generateWorkflowMock
      .mockResolvedValueOnce(responseFixture())
      .mockRejectedValueOnce(new WorkflowApiError("Workflow generation timed out. Please try again.", "provider_timeout", 504, null))
    render(<App />)

    enterPrompt("Create a workflow")
    submitPrompt()
    expect(await screen.findByRole("heading", { name: "Lead qualification workflow" })).toBeInTheDocument()

    enterPrompt("Try the workflow again")
    submitPrompt()
    expect(await screen.findByRole("alert")).toHaveTextContent("Workflow generation timed out. Please try again.")
    expect(screen.getByRole("heading", { name: "Lead qualification workflow" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Lead qualification workflow" })).not.toBeInTheDocument()
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveValue("")
  })
})
