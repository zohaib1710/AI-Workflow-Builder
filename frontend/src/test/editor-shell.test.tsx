import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import EditorShell from "../components/editor/EditorShell"
import { EditorProvider, useEditorState } from "../editor/EditorContext"
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
      title: "Request review workflow",
      description: "Routes a request for review.",
      nodes: [
        { id: "start", type: "start", title: "Receive request", description: "A request arrives.", application: null },
        { id: "end", type: "end", title: "Complete review", description: "The review finishes.", application: null },
      ],
      edges: [{ id: "complete", source: "start", target: "end", label: null }],
      assumptions: [],
      missingRequirements: [],
      suggestions: [],
    },
    generation: { model: "test-model", durationMs: 12 },
  }
}

function StateObserver() {
  const state = useEditorState()
  if (!state) return <output data-testid="editor-state">empty</output>
  return (
    <output data-testid="editor-state">
      {`${state.present.workflow.title}|${Object.keys(state.present.nodePresentations).length}|${state.past.length}`}
    </output>
  )
}

function renderShell(observeState = false) {
  return render(
    <EditorProvider>
      <EditorShell />
      {observeState && <StateObserver />}
    </EditorProvider>,
  )
}

function enterAndGenerate(prompt = "  Create a request review workflow  ") {
  fireEvent.change(screen.getByRole("textbox", { name: "Workflow prompt" }), {
    target: { value: prompt },
  })
  fireEvent.click(screen.getByRole("button", { name: "Generate workflow" }))
}

describe("EditorShell", () => {
  it("renders one centered generation composer over an empty full-screen canvas", () => {
    renderShell()

    const shell = screen.getByTestId("editor-shell")
    const canvas = screen.getByLabelText("Workflow canvas surface")
    expect(shell).toHaveClass("editor-shell")
    expect(canvas).toHaveClass("editor-canvas")
    expect(canvas.parentElement).toBe(shell)
    expect(screen.getByLabelText("Empty workflow canvas")).toBeInTheDocument()
    expect(screen.getByRole("banner", { name: "Editor controls" })).toHaveClass("editor-floating-controls")
    expect(document.querySelector(".editor-shell__toolbar-reserve")).not.toBeInTheDocument()
    expect(document.querySelector(".editor-shell__inspector-reserve")).not.toBeInTheDocument()
    expect(screen.getAllByRole("form")).toHaveLength(1)
    expect(screen.getByRole("form")).toHaveAccessibleName("Describe your workflow")
    expect(screen.getByPlaceholderText("Describe the workflow you want to create...")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate workflow" })).toBeInTheDocument()
    expect(document.querySelector('[data-composer-mode="generate"]')).toHaveClass("editor-composer--generate")
    expect(document.querySelector('[data-composer-mode="iterate"]')).not.toBeInTheDocument()
  })

  it("adopts a successful generation into editor semantic and presentation state", async () => {
    generateWorkflowMock.mockResolvedValue(responseFixture())
    renderShell(true)

    enterAndGenerate()

    expect(generateWorkflowMock).toHaveBeenCalledTimes(1)
    expect(generateWorkflowMock).toHaveBeenCalledWith({ prompt: "Create a request review workflow" })
    expect(await screen.findByRole("heading", { name: "Request review workflow" })).toBeInTheDocument()
    expect(screen.getByTestId("editor-state")).toHaveTextContent("Request review workflow|2|0")
    expect(screen.getByLabelText("Read-only workflow diagram")).toBeInTheDocument()
    expect(screen.getAllByRole("form")).toHaveLength(1)
    expect(document.querySelector('[data-composer-mode="iterate"]')).toHaveClass("editor-composer--iterate")
    expect(screen.getByRole("banner", { name: "Editor controls" })).toHaveClass("editor-floating-controls")
    expect(screen.getByPlaceholderText("Ask AI to modify this workflow...")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Update workflow" })).toBeDisabled()
  })

  it("keeps the centered empty state and safe prompt after generation fails", async () => {
    generateWorkflowMock.mockRejectedValue(
      new WorkflowApiError("Workflow generation is temporarily unavailable.", "provider_not_configured", 503, null),
    )
    renderShell()

    enterAndGenerate("Keep this prompt")

    expect(await screen.findByRole("alert")).toHaveTextContent("Workflow generation is temporarily unavailable.")
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveValue("Keep this prompt")
    expect(document.querySelector('[data-composer-mode="generate"]')).toHaveClass("editor-composer--generate")
    expect(screen.queryByLabelText("Read-only workflow diagram")).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText("Ask AI to modify this workflow...")).not.toBeInTheDocument()
  })

  it("starts a new workflow locally and returns the same composer to center", async () => {
    generateWorkflowMock.mockResolvedValue(responseFixture())
    renderShell()
    enterAndGenerate()
    await screen.findByRole("heading", { name: "Request review workflow" })

    fireEvent.change(screen.getByRole("textbox", { name: "Workflow prompt" }), {
      target: { value: "Future edit" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: "New workflow" })[0])

    await waitFor(() => expect(screen.getByLabelText("Empty workflow canvas")).toBeInTheDocument())
    expect(screen.getAllByRole("form")).toHaveLength(1)
    expect(document.querySelector('[data-composer-mode="generate"]')).toHaveClass("editor-composer--generate")
    expect(screen.getByPlaceholderText("Describe the workflow you want to create...")).toHaveValue("")
    expect(screen.queryByRole("heading", { name: "Request review workflow" })).not.toBeInTheDocument()
    expect(generateWorkflowMock).toHaveBeenCalledTimes(1)
  })

  it("shows the current bounded editor toolbar", async () => {
    generateWorkflowMock.mockResolvedValue(responseFixture())
    renderShell()
    enterAndGenerate()

    expect(await screen.findByLabelText("Read-only workflow diagram")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add shape" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Auto Arrange" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
    expect(screen.queryByText(/node inspector|edge inspector/i)).not.toBeInTheDocument()
  })

  it("exposes the CSS-governed narrow-screen editing notice", () => {
    renderShell()
    const notice = screen.getByText("Manual editing is available on larger screens. AI editing and canvas navigation remain available here.")
    expect(notice).toHaveClass("editor-responsive-notice")
  })

  it("opens read-only insights without replacing the canvas and returns focus on close", async () => {
    const response = responseFixture()
    response.workflow.assumptions = ["The requester is known."]
    response.workflow.missingRequirements = ["Define the reviewer."]
    response.workflow.suggestions = ["Track response time."]
    render(
      <EditorProvider workflow={response.workflow}>
        <EditorShell />
      </EditorProvider>,
    )

    const trigger = screen.getByRole("button", { name: "Insights" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("complementary", { name: "Workflow insights" })).not.toBeInTheDocument()
    fireEvent.click(trigger)

    const drawer = screen.getByRole("complementary", { name: "Workflow insights" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByLabelText("Read-only workflow diagram")).toBeInTheDocument()
    expect(within(drawer).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Assumptions", "Missing requirements", "Suggestions",
    ])
    expect(within(drawer).getByText("The requester is known.")).toBeInTheDocument()
    expect(within(drawer).getByText("Define the reviewer.")).toBeInTheDocument()
    expect(within(drawer).getByText("Track response time.")).toBeInTheDocument()
    expect(within(drawer).queryByRole("textbox")).not.toBeInTheDocument()
    expect(within(drawer).getByRole("heading", { name: "Workflow insights" })).toHaveFocus()

    fireEvent.click(within(drawer).getByRole("button", { name: "Close insights" }))
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole("complementary", { name: "Workflow insights" })).not.toBeInTheDocument()
  })

  it("keeps valid AI editing and navigation available on narrow screens while manual tools stay disabled", () => {
    const originalMatchMedia = window.matchMedia
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      media: "(min-width: 768px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    render(
      <EditorProvider workflow={responseFixture().workflow}>
        <EditorShell />
      </EditorProvider>,
    )

    expect(screen.getByRole("button", { name: "Add shape" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Auto Arrange" })).toBeDisabled()
    fireEvent.change(screen.getByRole("textbox", { name: "Workflow prompt" }), {
      target: { value: "Add a review step." },
    })
    expect(screen.getByRole("button", { name: "Update workflow" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Zoom In" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Insights" })).toBeEnabled()
    expect(screen.getByText(/AI editing and canvas navigation remain available here/)).toBeInTheDocument()
    vi.stubGlobal("matchMedia", originalMatchMedia)
  })
})
