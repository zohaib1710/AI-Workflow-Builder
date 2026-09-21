import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
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

  it("shows the current manual toolbar without future history controls", async () => {
    generateWorkflowMock.mockResolvedValue(responseFixture())
    renderShell()
    enterAndGenerate()

    expect(await screen.findByLabelText("Read-only workflow diagram")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add shape" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /delete node|undo|redo/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/node inspector|edge inspector/i)).not.toBeInTheDocument()
  })

  it("exposes the CSS-governed narrow-screen editing notice", () => {
    renderShell()
    const notice = screen.getByText("Workflow editing is optimized for tablet and desktop screens.")
    expect(notice).toHaveClass("editor-responsive-notice")
  })
})
