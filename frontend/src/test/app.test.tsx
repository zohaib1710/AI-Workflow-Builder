import type { ReactNode } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import App from "../App"
import { WorkflowApiError } from "../api/client"
import type { GenerateWorkflowResponse } from "../types/workflow"

const generateWorkflowMock = vi.hoisted(() => vi.fn())
const repositoryMocks = vi.hoisted(() => ({ listOwnedWorkflows: vi.fn(), loadLatestWorkflow: vi.fn(), createWorkflowRecord: vi.fn(), saveWorkflowVersion: vi.fn() }))

vi.mock("../auth/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    user: { id: "test-user", email: "test@example.com" },
    session: {},
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock("../editor/workflowRepository", () => repositoryMocks)

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return { ...actual, generateWorkflow: generateWorkflowMock }
})

beforeEach(() => {
  repositoryMocks.listOwnedWorkflows.mockResolvedValue([])
  repositoryMocks.createWorkflowRecord.mockResolvedValue("new-workflow-id")
  repositoryMocks.saveWorkflowVersion.mockResolvedValue(2)
})

afterEach(() => {
  cleanup()
  generateWorkflowMock.mockReset()
  Object.values(repositoryMocks).forEach((mock) => mock.mockClear())
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
    },
    generation: { model: "test-model", durationMs: 25 },
  }
}

function renderNewWorkflow() {
  render(<App />)
  fireEvent.click(screen.getByRole("button", { name: /^new workflow$/i }))
}

function enterPrompt(value = "  Create a lead qualification workflow  ") {
  fireEvent.change(screen.getByRole("textbox", { name: "Workflow prompt" }), {
    target: { value },
  })
}

function submitPrompt() {
  fireEvent.click(screen.getByRole("button", { name: "Generate workflow" }))
}

describe("App workflow generation", () => {
  it("lands on My workflows and offers a new workflow", async () => {
    render(<App />)
    expect(await screen.findByRole("heading", { name: "My workflows" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^new workflow$/i })).toBeInTheDocument()
    expect(screen.getByText("No saved workflows yet")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Workflow prompt" })).not.toBeInTheDocument()
  })

  it("opens a saved workflow cleanly and returns to the library", async () => {
    const savedWorkflow = {
      id: "saved-workflow-id",
      workflow: { title: "Saved lead workflow", description: "Previously saved", nodes: [], edges: [] },
      nodePresentations: {},
      annotations: [],
      versionNumber: 3,
    }
    repositoryMocks.listOwnedWorkflows.mockResolvedValue([
      { id: savedWorkflow.id, title: savedWorkflow.workflow.title, description: savedWorkflow.workflow.description, updatedAt: "2026-09-30T10:00:00Z" },
    ])
    repositoryMocks.loadLatestWorkflow.mockResolvedValue(savedWorkflow)
    const confirm = vi.spyOn(window, "confirm")

    render(<App />)
    fireEvent.click(await screen.findByRole("button", { name: "Open workflow" }))

    expect(await screen.findByTestId("editor-shell")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Saved lead workflow" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "My workflows" }))
    expect(await screen.findByRole("heading", { name: "My workflows" })).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it("submits the normalized prompt once and renders the generated canvas", async () => {
    generateWorkflowMock.mockResolvedValue(responseFixture())
    renderNewWorkflow()

    enterPrompt()
    submitPrompt()

    expect(generateWorkflowMock).toHaveBeenCalledTimes(1)
    expect(generateWorkflowMock).toHaveBeenCalledWith({ prompt: "Create a lead qualification workflow" })
    expect(await screen.findByRole("heading", { name: "Lead qualification workflow" })).toBeInTheDocument()
    expect(screen.getByLabelText("Read-only workflow diagram")).toBeInTheDocument()
  })

  it("shows loading, disables conflicting actions, and prevents duplicate submission", async () => {
    let resolveRequest!: (response: GenerateWorkflowResponse) => void
    generateWorkflowMock.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    renderNewWorkflow()

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
    renderNewWorkflow()

    enterPrompt("Create a workflow")
    submitPrompt()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The workflow generation service is unavailable. Please try again.",
    )
    expect(screen.queryByText("SUPER_SECRET_TEST_VALUE")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveValue("")
  })

})
