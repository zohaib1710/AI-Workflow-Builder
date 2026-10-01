import { describe, expect, it, vi } from "vitest"
import { archiveWorkflow, listWorkflowLibrary, listWorkflowVersions, loadWorkflowVersion, parseSavedWorkflow, parseWorkflowVersionSummary, renameWorkflow, restoreWorkflow } from "../editor/workflowRepository"

const supabaseMocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock("../lib/supabase", () => ({ supabase: supabaseMocks }))

const validVersion = {
  version_number: 1,
  semantic_workflow: { title: "Test", description: "Desc", nodes: [{ id: "start", type: "start", title: "Start", description: "Beginning", application: null }], edges: [] },
  presentation_state: { nodePresentations: { start: { nodeId: "start", shape: "terminator", position: { x: 1, y: 2 } } }, annotations: [] },
}

describe("saved workflow repository data validation", () => {
  it("parses a complete persisted semantic and presentation snapshot", () => {
    expect(parseSavedWorkflow("wf-1", validVersion)).toMatchObject({ id: "wf-1", versionNumber: 1, workflow: validVersion.semantic_workflow, nodePresentations: validVersion.presentation_state.nodePresentations })
  })

  it("rejects malformed semantic workflow or presentation payloads", () => {
    expect(() => parseSavedWorkflow("wf-1", { ...validVersion, semantic_workflow: { title: "bad" } })).toThrow(/invalid workflow data/)
    expect(() => parseSavedWorkflow("wf-1", { ...validVersion, presentation_state: {} })).toThrow(/missing its canvas layout/)
  })

  it("normalizes version names and rejects malformed metadata", () => {
    expect(parseWorkflowVersionSummary({ version_number: 3, change_summary: "  Updated routing  ", created_at: "2026-09-30T10:00:00Z" })).toEqual({ versionNumber: 3, name: "Updated routing", createdAt: "2026-09-30T10:00:00Z" })
    expect(parseWorkflowVersionSummary({ version_number: 2, change_summary: "  ", created_at: "2026-09-30T10:00:00Z" }).name).toBe("Version 2")
    expect(() => parseWorkflowVersionSummary({ version_number: 0, change_summary: null, created_at: "invalid" })).toThrow(/version details are invalid/)
  })

  it("lists versions in database order and loads a selected version through strict parsing", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), maybeSingle: vi.fn() }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.order.mockResolvedValue({ data: [
      { version_number: 2, change_summary: "Newer", created_at: "2026-09-30T11:00:00Z" },
      { version_number: 1, change_summary: "Initial workflow", created_at: "2026-09-30T10:00:00Z" },
    ], error: null })
    supabaseMocks.from.mockReturnValue(query)
    await expect(listWorkflowVersions("wf-1")).resolves.toMatchObject([{ versionNumber: 2, name: "Newer" }, { versionNumber: 1, name: "Initial workflow" }])
    expect(query.order).toHaveBeenCalledWith("version_number", { ascending: false })

    query.order.mockReset()
    query.maybeSingle.mockResolvedValue({ data: validVersion, error: null })
    await expect(loadWorkflowVersion("wf-1", 1)).resolves.toMatchObject({ id: "wf-1", versionNumber: 1 })
    expect(query.eq).toHaveBeenLastCalledWith("version_number", 1)
  })

  it("calls the rename RPC and validates its returned version metadata", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: { version_number: 4, updated_at: "2026-09-30T12:00:00Z" }, error: null })
    await expect(renameWorkflow("wf-1", "  New title  ")).resolves.toEqual({ versionNumber: 4, updatedAt: "2026-09-30T12:00:00Z" })
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("rename_owned_workflow", { p_workflow_id: "wf-1", p_new_title: "New title" })
    supabaseMocks.rpc.mockResolvedValue({ data: { version_number: 0, updated_at: "bad" }, error: null })
    await expect(renameWorkflow("wf-1", "New title")).rejects.toThrow(/invalid confirmation data/)
  })

  it("splits owned workflows into active and archived lists and validates archive ownership metadata", async () => {
    const makeQuery = (data: unknown) => {
      const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
      query.select.mockReturnValue(query)
      query.eq.mockReturnValue(query)
      query.order.mockResolvedValue({ data, error: null })
      return query
    }
    const workflows = makeQuery([
      { id: "wf-a", title: "Archived", description: "Old", updated_at: "2026-10-01T00:00:00Z" },
      { id: "wf-b", title: "Active", description: "Current", updated_at: "2026-09-30T00:00:00Z" },
    ])
    const archives = makeQuery([{ workflow_id: "wf-a", archived_at: "2026-10-02T00:00:00Z", archived_by: "user-1" }])
    supabaseMocks.from.mockImplementation((table: string) => table === "workflows" ? workflows : archives)
    await expect(listWorkflowLibrary("user-1")).resolves.toEqual({
      active: [{ id: "wf-b", title: "Active", description: "Current", updatedAt: "2026-09-30T00:00:00Z" }],
      archived: [{ id: "wf-a", title: "Archived", description: "Old", updatedAt: "2026-10-01T00:00:00Z", archivedAt: "2026-10-02T00:00:00Z" }],
    })
    expect(workflows.eq).toHaveBeenCalledWith("owner_id", "user-1")
    expect(archives.eq).toHaveBeenCalledWith("archived_by", "user-1")
    archives.order.mockResolvedValue({ data: [{ workflow_id: "wf-a", archived_at: "bad", archived_by: "someone-else" }], error: null })
    await expect(listWorkflowLibrary("user-1")).rejects.toThrow(/archive list contains invalid data/)
    archives.order.mockResolvedValue({ data: null, error: { code: "42P01", message: "missing relation" } })
    await expect(listWorkflowLibrary("user-1")).rejects.toMatchObject({ code: "42P01" })
  })

  it("archives and restores using only the archive marker table", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const archiveDelete = { eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }
    archiveDelete.eq.mockReturnValue(archiveDelete)
    archiveDelete.select.mockReturnValue(archiveDelete)
    archiveDelete.maybeSingle.mockResolvedValue({ data: { workflow_id: "wf-a" }, error: null })
    supabaseMocks.from.mockImplementation((table: string) => table === "workflow_archives" ? { insert, delete: () => archiveDelete } : null)
    await expect(archiveWorkflow("wf-a", "user-1")).resolves.toBeUndefined()
    expect(supabaseMocks.from).toHaveBeenCalledWith("workflow_archives")
    expect(insert).toHaveBeenCalledWith({ workflow_id: "wf-a", archived_by: "user-1" })
    await expect(restoreWorkflow("wf-a", "user-1")).resolves.toBeUndefined()
    expect(archiveDelete.eq).toHaveBeenNthCalledWith(1, "workflow_id", "wf-a")
    expect(archiveDelete.eq).toHaveBeenNthCalledWith(2, "archived_by", "user-1")
  })
})
