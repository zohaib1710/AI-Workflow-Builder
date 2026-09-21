import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorkflowApiError } from "../api/client"
import EditorShell from "../components/editor/EditorShell"
import { EditorProvider, useEditorDispatch, useEditorState } from "../editor/EditorContext"
import type { EditorState } from "../editor/types"
import type { EditWorkflowResponse, Workflow } from "../types/workflow"

const editWorkflowMock = vi.hoisted(() => vi.fn())

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return { ...actual, editWorkflow: editWorkflowMock }
})

afterEach(() => {
  cleanup()
  editWorkflowMock.mockReset()
})

function initialWorkflow(): Workflow {
  return {
    title: "Request workflow",
    description: "Routes an incoming request.",
    nodes: [
      { id: "start", type: "start", title: "Receive request", description: "A request arrives.", application: null },
      { id: "remove", type: "action", title: "Manual review", description: "Review the request.", application: null },
      { id: "end", type: "end", title: "Complete", description: "Finish the request.", application: null },
    ],
    edges: [
      { id: "to-review", source: "start", target: "remove", label: null },
      { id: "to-end", source: "remove", target: "end", label: null },
    ],
    assumptions: ["Requests contain contact details."],
    missingRequirements: ["Escalation owner."],
    suggestions: ["Track completion time."],
  }
}

function revisedResponse(): EditWorkflowResponse {
  return {
    workflow: {
      title: "Automated request workflow",
      description: "Routes and acknowledges an incoming request.",
      nodes: [
        { id: "start", type: "start", title: "Capture request", description: "Capture a new request.", application: "Portal" },
        { id: "notify", type: "notification", title: "Send acknowledgement", description: "Notify the requester.", application: "Email" },
        { id: "end", type: "end", title: "Complete", description: "Finish the request.", application: null },
      ],
      edges: [
        { id: "to-notify", source: "start", target: "notify", label: null },
        { id: "notify-to-end", source: "notify", target: "end", label: null },
      ],
      assumptions: ["Email delivery is available."],
      missingRequirements: [],
      suggestions: ["Measure acknowledgement time."],
    },
    generation: { model: "test-model", durationMs: 22 },
  }
}

function EditorSetup() {
  const dispatch = useEditorDispatch()
  useEffect(() => {
    dispatch({ type: "node/position-commit", nodeId: "start", position: { x: 333, y: 444 } })
    dispatch({ type: "node/shape-commit", nodeId: "start", shape: "document" })
    dispatch({
      type: "annotation/create",
      annotation: { id: "note", text: "Keep this note", position: { x: 80, y: 90 } },
    })
    dispatch({ type: "selection/set", selection: { kind: "node", nodeId: "remove" } })
  }, [dispatch])
  return null
}

function StateObserver() {
  const state = useEditorState()
  return <output data-testid="editor-state">{JSON.stringify(state)}</output>
}

function renderEditor(workflow = initialWorkflow(), withSetup = false) {
  return render(
    <EditorProvider workflow={workflow}>
      {withSetup && <EditorSetup />}
      <EditorShell />
      <StateObserver />
    </EditorProvider>,
  )
}

function readState(): EditorState {
  return JSON.parse(screen.getByTestId("editor-state").textContent ?? "null") as EditorState
}

function submitInstruction(instruction: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Workflow prompt" }), {
    target: { value: instruction },
  })
  fireEvent.click(screen.getByRole("button", { name: "Update workflow" }))
}

describe("AI workflow iteration", () => {
  it("submits one trimmed instruction with only the current semantic workflow", async () => {
    editWorkflowMock.mockResolvedValue(revisedResponse())
    renderEditor()

    fireEvent.change(screen.getByRole("textbox", { name: "Workflow prompt" }), {
      target: { value: "   " },
    })
    fireEvent.submit(screen.getByRole("form"))
    expect(editWorkflowMock).not.toHaveBeenCalled()

    submitInstruction("  Add an acknowledgement step.  ")
    await waitFor(() => expect(editWorkflowMock).toHaveBeenCalledTimes(1))

    const request = editWorkflowMock.mock.calls[0][0]
    expect(request).toEqual({
      instruction: "Add an acknowledgement step.",
      workflow: initialWorkflow(),
    })
    expect(Object.keys(request)).toEqual(["instruction", "workflow"])
    expect(request).not.toHaveProperty("presentation")
    expect(request).not.toHaveProperty("annotations")
    expect(request).not.toHaveProperty("selection")
    expect(request).not.toHaveProperty("viewport")
    expect(request).not.toHaveProperty("history")
  })

  it("commits a reconciled revision atomically as one history transaction", async () => {
    editWorkflowMock.mockResolvedValue(revisedResponse())
    renderEditor(initialWorkflow(), true)
    await waitFor(() => expect(readState().past).toHaveLength(3))
    const before = readState()

    submitInstruction("Automate the acknowledgement.")

    await waitFor(() => expect(readState().present.workflow.title).toBe("Automated request workflow"))
    const after = readState()
    expect(after.present.workflow.assumptions).toEqual(["Email delivery is available."])
    expect(after.present.workflow.missingRequirements).toEqual([])
    expect(after.present.workflow.suggestions).toEqual(["Measure acknowledgement time."])
    expect(after.present.nodePresentations.start).toEqual({
      nodeId: "start",
      shape: "document",
      position: { x: 333, y: 444 },
    })
    expect(after.present.nodePresentations.notify).toBeDefined()
    expect(after.present.nodePresentations.remove).toBeUndefined()
    expect(after.present.annotations).toEqual(before.present.annotations)
    expect(after.past).toHaveLength(before.past.length + 1)
    expect(after.future).toEqual([])
    expect(after.selection).toEqual({ kind: "none" })
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveValue("")
    expect(document.querySelector('[data-composer-mode="iterate"]')).toBeInTheDocument()
  })

  it("blocks an invalid draft, reveals validation feedback, and leaves repair controls enabled", async () => {
    const invalid = initialWorkflow()
    invalid.edges = []
    renderEditor(invalid)
    const before = readState()

    submitInstruction("Fix this workflow.")

    expect(editWorkflowMock).not.toHaveBeenCalled()
    expect(readState().present).toEqual(before.present)
    expect(readState().past).toEqual(before.past)
    const validation = document.querySelector("details.validation-indicator")
    await waitFor(() => expect(validation).toHaveAttribute("open"))
    expect(validation?.querySelector("summary")).toHaveFocus()
    expect(screen.getByRole("button", { name: "Add shape" })).toBeEnabled()
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveValue("Fix this workflow.")
  })

  it("shows editing status, prevents duplicates, locks mutations, and keeps navigation visible", async () => {
    let resolveEdit!: (value: EditWorkflowResponse) => void
    editWorkflowMock.mockImplementation(() => new Promise((resolve) => {
      resolveEdit = resolve
    }))
    renderEditor()

    submitInstruction("Add an acknowledgement.")

    const editingStatus = await screen.findByText("Updating workflow...", {
      selector: '[role="status"]',
    })
    expect(editingStatus).toHaveAttribute("aria-live", "polite")
    expect(screen.getByRole("heading", { name: "Request workflow" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Updating workflow..." })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add shape" })).toBeDisabled()
    expect(screen.getAllByRole("button", { name: "New workflow" }).some((button) => button.hasAttribute("disabled"))).toBe(true)
    expect(screen.getByRole("button", { name: "Zoom In" })).toBeEnabled()
    fireEvent.submit(screen.getByRole("form"))
    expect(editWorkflowMock).toHaveBeenCalledTimes(1)

    resolveEdit(revisedResponse())
    await waitFor(() => expect(screen.queryByText("Updating workflow...")).not.toBeInTheDocument())
  })

  it("preserves the complete editor state and instruction after a controlled API failure", async () => {
    editWorkflowMock.mockRejectedValue(
      new WorkflowApiError("Workflow generation is busy right now. Please try again shortly.", "provider_rate_limited", 429, null),
    )
    renderEditor(initialWorkflow(), true)
    await waitFor(() => expect(readState().past).toHaveLength(3))
    const before = readState()

    submitInstruction("Add an acknowledgement.")

    expect(await screen.findByRole("alert")).toHaveTextContent("Workflow generation is busy right now.")
    const after = readState()
    expect(after.present).toEqual(before.present)
    expect(after.past).toEqual(before.past)
    expect(after.future).toEqual(before.future)
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveValue("Add an acknowledgement.")
  })

  it("rejects identity instability without applying any part of the revision", async () => {
    const response = revisedResponse()
    response.workflow.nodes = [
      { id: "replacement", type: "action", title: "Replacement", description: "A replacement step.", application: null },
    ]
    response.workflow.edges = []
    editWorkflowMock.mockResolvedValue(response)
    renderEditor(initialWorkflow(), true)
    await waitFor(() => expect(readState().past).toHaveLength(3))
    const before = readState()

    submitInstruction("Replace everything.")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The revised workflow could not preserve the current canvas layout. Try a more specific edit.",
    )
    const after = readState()
    expect(after.present).toEqual(before.present)
    expect(after.past).toEqual(before.past)
    expect(after.future).toEqual(before.future)
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveValue("Replace everything.")
  })
})
