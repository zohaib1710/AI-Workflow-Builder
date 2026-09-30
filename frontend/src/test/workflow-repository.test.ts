import { describe, expect, it, vi } from "vitest"
import { parseSavedWorkflow } from "../editor/workflowRepository"

vi.mock("../lib/supabase", () => ({ supabase: { from: vi.fn() } }))

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
})
