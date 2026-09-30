import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import WorkflowLibrary from "../components/editor/WorkflowLibrary"

const repo = vi.hoisted(() => ({ listOwnedWorkflows: vi.fn(), loadLatestWorkflow: vi.fn(), renameWorkflow: vi.fn() }))
vi.mock("../editor/workflowRepository", () => repo)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const row = { id: "wf-1", title: "Lead intake", description: "Routes incoming leads", updatedAt: "2026-09-30T10:00:00Z" }
const saved = { id: "wf-1", workflow: { title: "Lead intake", description: "Routes incoming leads", nodes: [], edges: [] }, nodePresentations: {}, annotations: [], versionNumber: 1 }

describe("WorkflowLibrary", () => {
  it("lists saved workflows and opens their latest valid snapshot", async () => {
    repo.listOwnedWorkflows.mockResolvedValue([row])
    repo.loadLatestWorkflow.mockResolvedValue(saved)
    const onOpen = vi.fn()
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={onOpen} />)
    fireEvent.click(await screen.findByRole("button", { name: "Open workflow" }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("heading", { name: "Lead intake" })).toBeInTheDocument()
    expect(onOpen.mock.calls[0][0]).toEqual(saved)
    expect(onOpen.mock.calls[0][1]).toEqual({ workflow: saved.workflow, nodePresentations: {}, annotations: [] })
  })

  it("keeps the library visible and offers retry when opening fails", async () => {
    repo.listOwnedWorkflows.mockResolvedValue([row])
    repo.loadLatestWorkflow
      .mockRejectedValueOnce(new Error("invalid saved payload"))
      .mockResolvedValueOnce(saved)
    const onOpen = vi.fn()
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={onOpen} />)
    fireEvent.click(await screen.findByRole("button", { name: "Open workflow" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't open that workflow")
    expect(screen.getByRole("heading", { name: "Lead intake" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
    expect(repo.loadLatestWorkflow).toHaveBeenCalledTimes(2)
  })

  it("retries a failed workflow-list request and keeps account actions available", async () => {
    repo.listOwnedWorkflows.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([])
    const onSignOut = vi.fn().mockResolvedValue(undefined)
    render(<WorkflowLibrary userId="user-1" userEmail="person@example.com" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} onSignOut={onSignOut} />)

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your workflows")
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("No saved workflows yet")).toBeInTheDocument()
    expect(repo.listOwnedWorkflows).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it("renames a workflow and refreshes its library title", async () => {
    repo.listOwnedWorkflows.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ ...row, title: "Qualified leads" }])
    repo.renameWorkflow.mockResolvedValue({ versionNumber: 2, updatedAt: "2026-10-01T10:00:00Z" })
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: "Rename" }))
    expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("Lead intake")
    const dialog = screen.getByRole("dialog", { name: "Rename workflow" })
    expect(within(dialog).getByRole("button", { name: "Rename" })).toBeDisabled()
    fireEvent.change(screen.getByRole("textbox", { name: "Workflow name" }), { target: { value: "  Qualified leads  " } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }))
    expect(await screen.findByRole("heading", { name: "Qualified leads" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Workflow renamed to “Qualified leads”.")
    expect(repo.renameWorkflow).toHaveBeenCalledWith("wf-1", "Qualified leads")
    expect(repo.listOwnedWorkflows).toHaveBeenCalledTimes(2)
  })

  it("keeps the existing card and name available when rename fails", async () => {
    repo.listOwnedWorkflows.mockResolvedValue([row])
    repo.renameWorkflow.mockRejectedValue(new Error("database error"))
    render(<WorkflowLibrary userId="user-1" refreshKey={0} onCreate={vi.fn()} onOpen={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: "Rename" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Workflow name" }), { target: { value: "New title" } })
    fireEvent.click(within(screen.getByRole("dialog", { name: "Rename workflow" })).getByRole("button", { name: "Rename" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't rename this workflow")
    expect(screen.getByRole("heading", { name: "Lead intake" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("New title")
  })
})
