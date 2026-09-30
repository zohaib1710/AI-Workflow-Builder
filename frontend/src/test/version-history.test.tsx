import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import EditorShell from "../components/editor/EditorShell"
import { EditorProvider, useEditorDispatch, useEditorState } from "../editor/EditorContext"
import { createInitialEditorState } from "../editor/editorReducer"
import { fingerprintSnapshot } from "../editor/snapshotFingerprint"
import type { EditorSnapshot } from "../editor/types"
import type { Workflow } from "../types/workflow"

const repository = vi.hoisted(() => ({
  createWorkflowRecord: vi.fn(),
  saveWorkflowVersion: vi.fn(),
  loadWorkflowVersion: vi.fn(),
  listWorkflowVersions: vi.fn(),
}))
vi.mock("../editor/workflowRepository", () => repository)

const workflow: Workflow = { title: "Current workflow", description: "Saved description", nodes: [], edges: [] }
const currentSnapshot = createInitialEditorState(workflow).present
const oldSnapshot: EditorSnapshot = { ...currentSnapshot, workflow: { ...workflow, title: "Older workflow" } }

function StateObserver() {
  const state = useEditorState()
  return <output data-testid="history-state">{state ? `${state.present.workflow.title}|${state.past.length}` : "empty"}</output>
}

function DirtyButton() {
  const dispatch = useEditorDispatch()
  return <button type="button" onClick={() => dispatch({ type: "snapshot/record", snapshot: { ...currentSnapshot, workflow: { ...workflow, title: "Unsaved change" } } })}>Make dirty</button>
}

async function renderSavedEditor() {
  const savedFingerprint = await fingerprintSnapshot(currentSnapshot)
  render(
    <EditorProvider initialSnapshot={currentSnapshot}>
      <EditorShell userId="user-1" workflowId="wf-1" initialLatestSavedVersionNumber={2} initialSavedFingerprint={savedFingerprint} />
      <StateObserver />
    </EditorProvider>,
  )
}

beforeEach(() => {
  repository.createWorkflowRecord.mockReset()
  repository.saveWorkflowVersion.mockReset()
  repository.loadWorkflowVersion.mockReset()
  repository.listWorkflowVersions.mockReset()
  repository.listWorkflowVersions.mockResolvedValue([
    { versionNumber: 2, name: "Current saved version", createdAt: "2026-09-30T12:00:00Z" },
    { versionNumber: 1, name: "Initial workflow", createdAt: "2026-09-29T12:00:00Z" },
  ])
  repository.loadWorkflowVersion.mockResolvedValue({ id: "wf-1", ...oldSnapshot, versionNumber: 1 })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("workflow version history and restore", () => {
  it("shows newest-first versions and restores an older version as one undoable draft without saving", async () => {
    await renderSavedEditor()
    expect(screen.getByRole("button", { name: "Version history" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Version history" }))

    expect(await screen.findByRole("heading", { name: "Version history" })).toBeInTheDocument()
    const entries = screen.getAllByRole("listitem")
    expect(entries[0]).toHaveTextContent("Version 2")
    expect(entries[0]).toHaveTextContent("Latest")
    expect(entries[1]).toHaveTextContent("Version 1")
    expect(screen.getByRole("button", { name: "Restore version 2" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Restore version 1" }))
    await waitFor(() => expect(screen.getByTestId("history-state")).toHaveTextContent("Older workflow|1"))
    expect(await screen.findByText("Version 1 loaded as an unsaved draft")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Save" })).toBeEnabled()
    expect(repository.loadWorkflowVersion).toHaveBeenCalledWith("wf-1", 1)
    expect(repository.saveWorkflowVersion).not.toHaveBeenCalled()
    expect(repository.createWorkflowRecord).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    await waitFor(() => expect(screen.getByTestId("history-state")).toHaveTextContent("Current workflow|0"))
  })

  it("leaves a dirty draft unchanged when restore confirmation is cancelled", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const savedFingerprint = await fingerprintSnapshot(currentSnapshot)
    render(
      <EditorProvider initialSnapshot={currentSnapshot}>
        <EditorShell userId="user-1" workflowId="wf-1" initialLatestSavedVersionNumber={2} initialSavedFingerprint={savedFingerprint} />
        <StateObserver />
        <DirtyButton />
      </EditorProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Make dirty" }))
    fireEvent.click(screen.getByRole("button", { name: "Version history" }))
    fireEvent.click(await screen.findByRole("button", { name: "Restore version 1" }))

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId("history-state")).toHaveTextContent("Unsaved change|1")
    expect(repository.loadWorkflowVersion).not.toHaveBeenCalled()
  })

  it("keeps the editor intact when loading a historical snapshot fails", async () => {
    repository.loadWorkflowVersion.mockRejectedValue(new Error("Malformed stored snapshot"))
    await renderSavedEditor()
    fireEvent.click(screen.getByRole("button", { name: "Version history" }))
    fireEvent.click(await screen.findByRole("button", { name: "Restore version 1" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't restore that version")
    expect(screen.getByTestId("history-state")).toHaveTextContent("Current workflow|0")
    expect(screen.getByRole("heading", { name: "Version history" })).toBeInTheDocument()
  })
})
