import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import WorkflowLibrary from "../components/editor/WorkflowLibrary"

const repo = vi.hoisted(() => ({ listWorkflowLibrary: vi.fn(), loadLatestWorkflow: vi.fn(), renameWorkflow: vi.fn(), archiveWorkflow: vi.fn(), restoreWorkflow: vi.fn() }))
vi.mock("../editor/workflowRepository", () => repo)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const row = { id: "wf-1", title: "Lead intake", description: "Routes incoming leads", updatedAt: "2026-09-30T10:00:00Z" }
const archivedRow = { ...row, archivedAt: "2026-10-01T10:00:00Z" }
const saved = { id: "wf-1", workflow: { title: "Lead intake", description: "Routes incoming leads", nodes: [], edges: [] }, nodePresentations: {}, annotations: [], versionNumber: 1 }
const library = (active: typeof row[] = [row], archived: typeof archivedRow[] = []) => ({ active, archived })

describe("WorkflowLibrary", () => {
  it("uses the new product name, lists active workflows, and opens their latest valid snapshot", async () => {
    repo.listWorkflowLibrary.mockResolvedValue(library())
    repo.loadLatestWorkflow.mockResolvedValue(saved)
    const onOpen = vi.fn()
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={onOpen} />)
    expect(await screen.findByText("Systemapic Workflow Builder")).toBeInTheDocument()
    expect(document.querySelectorAll(".workflow-library__eyebrow svg circle")).toHaveLength(3)
    fireEvent.click(await screen.findByRole("button", { name: "Open workflow" }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
    expect(onOpen.mock.calls[0][0]).toEqual(saved)
    expect(onOpen.mock.calls[0][1]).toEqual({ workflow: saved.workflow, nodePresentations: {}, annotations: [] })
  })

  it("keeps the library visible and offers retry when opening fails", async () => {
    repo.listWorkflowLibrary.mockResolvedValue(library())
    repo.loadLatestWorkflow.mockRejectedValueOnce(new Error("invalid saved payload")).mockResolvedValueOnce(saved)
    const onOpen = vi.fn()
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={onOpen} />)
    fireEvent.click(await screen.findByRole("button", { name: "Open workflow" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't open that workflow")
    expect(screen.getByRole("heading", { name: "Lead intake" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
    expect(repo.loadLatestWorkflow).toHaveBeenCalledTimes(2)
  })

  it("retries a failed library request and keeps account actions available", async () => {
    repo.listWorkflowLibrary.mockRejectedValueOnce(new Error("missing archive table")).mockResolvedValueOnce(library([], []))
    const onSignOut = vi.fn().mockResolvedValue(undefined)
    render(<WorkflowLibrary userId="user-1" userEmail="person@example.com" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} onSignOut={onSignOut} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("archive status")
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("No active workflows")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: /Archived/ }))
    expect(screen.getByText("No archived workflows")).toBeInTheDocument()
  })

  it("cancels archive confirmation without changing the card", async () => {
    repo.listWorkflowLibrary.mockResolvedValue(library())
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }))
    const dialog = screen.getByRole("dialog", { name: "Archive workflow?" })
    expect(within(dialog).getByText(/saved versions will be kept/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Lead intake" })).toBeInTheDocument()
    expect(repo.archiveWorkflow).not.toHaveBeenCalled()
  })

  it("archives a workflow and refreshes both views without version writes", async () => {
    repo.listWorkflowLibrary.mockResolvedValueOnce(library()).mockResolvedValueOnce(library([], [archivedRow]))
    repo.archiveWorkflow.mockResolvedValue(undefined)
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }))
    fireEvent.click(within(screen.getByRole("dialog", { name: "Archive workflow?" })).getByRole("button", { name: "Archive workflow" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(repo.archiveWorkflow).toHaveBeenCalledWith("wf-1", "user-1")
    fireEvent.click(screen.getByRole("button", { name: /Archived/ }))
    expect(await screen.findByText("Archived 10/1/2026")).toBeInTheDocument()
  })

  it("restores an archived workflow into Active", async () => {
    repo.listWorkflowLibrary.mockResolvedValueOnce(library([], [archivedRow])).mockResolvedValueOnce(library([row], []))
    repo.restoreWorkflow.mockResolvedValue(undefined)
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: /Archived/ }))
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }))
    expect(repo.restoreWorkflow).toHaveBeenCalledWith("wf-1", "user-1")
    await waitFor(() => expect(repo.listWorkflowLibrary).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole("heading", { name: "Lead intake" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open workflow" })).toBeInTheDocument()
  })

  it("keeps archive failures retryable and the workflow data intact", async () => {
    repo.listWorkflowLibrary.mockResolvedValue(library())
    repo.archiveWorkflow.mockRejectedValueOnce(new Error("RLS error")).mockResolvedValueOnce(undefined)
    repo.listWorkflowLibrary.mockResolvedValueOnce(library()).mockResolvedValueOnce(library([], [archivedRow]))
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }))
    fireEvent.click(within(screen.getByRole("dialog", { name: "Archive workflow?" })).getByRole("button", { name: "Archive workflow" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't archive this workflow")
    expect(screen.getByRole("heading", { name: "Lead intake" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(repo.archiveWorkflow).toHaveBeenCalledTimes(2))
  })

  it("keeps archived entries visible when restore fails and allows retry", async () => {
    repo.listWorkflowLibrary.mockResolvedValueOnce(library([], [archivedRow]))
    repo.restoreWorkflow.mockRejectedValueOnce(new Error("RLS error")).mockResolvedValueOnce(undefined)
    repo.listWorkflowLibrary.mockResolvedValueOnce(library([row], []))
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: /Archived/ }))
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't restore this workflow")
    expect(screen.getByRole("heading", { name: "Lead intake" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(repo.restoreWorkflow).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole("button", { name: "Open workflow" })).toBeInTheDocument()
  })

  it("renames a workflow and refreshes its library title", async () => {
    repo.listWorkflowLibrary.mockResolvedValueOnce(library()).mockResolvedValueOnce(library([{ ...row, title: "Qualified leads" }]))
    repo.renameWorkflow.mockResolvedValue({ versionNumber: 2, updatedAt: "2026-10-01T10:00:00Z" })
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: "Rename" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Workflow name" }), { target: { value: "  Qualified leads  " } })
    fireEvent.click(within(screen.getByRole("dialog", { name: "Rename workflow" })).getByRole("button", { name: "Rename" }))
    expect(await screen.findByRole("heading", { name: "Qualified leads" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent('Workflow renamed to "Qualified leads".')
    expect(repo.renameWorkflow).toHaveBeenCalledWith("wf-1", "Qualified leads")
  })
})
