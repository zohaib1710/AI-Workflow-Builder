import { describe, expect, it, vi } from "vitest"
import { createEditorSnapshot, createInitialEditorState, editorReducer } from "../editor/editorReducer"
import { createUniqueEditorId } from "../editor/ids"
import { createInitialPresentation } from "../editor/presentation"
import { DEFAULT_SHAPE_BY_NODE_TYPE, type EditorSnapshot } from "../editor/types"
import type { SupportedNodeType, Workflow } from "../types/workflow"

function workflowWithTypes(types: SupportedNodeType[] = ["start", "action", "end"]): Workflow {
  const nodes = types.map((type, index) => ({
    id: `node-${index}`, type, title: `${type} node`, description: `A ${type} node.`, application: null,
  }))
  return {
    title: "Workflow", description: "A workflow.", nodes,
    edges: nodes.slice(1).map((node, index) => ({ id: `edge-${index}`, source: nodes[index].id, target: node.id, label: null })),
    assumptions: [], missingRequirements: [], suggestions: [],
  }
}

function renamedSnapshot(snapshot: EditorSnapshot, title: string): EditorSnapshot {
  return { ...snapshot, workflow: { ...snapshot.workflow, title } }
}

describe("editor presentation and state", () => {
  it("creates finite presentation-only records with exhaustive default shapes", () => {
    const types: SupportedNodeType[] = ["start", "end", "trigger", "action", "decision", "api", "database", "wait", "approval", "notification"]
    const workflow = workflowWithTypes(types)
    const before = structuredClone(workflow)
    const presentation = createInitialPresentation(workflow)

    expect(Object.keys(presentation)).toHaveLength(workflow.nodes.length)
    for (const node of workflow.nodes) {
      expect(presentation[node.id].shape).toBe(DEFAULT_SHAPE_BY_NODE_TYPE[node.type])
      expect(Number.isFinite(presentation[node.id].position.x)).toBe(true)
      expect(Number.isFinite(presentation[node.id].position.y)).toBe(true)
      expect(node).not.toHaveProperty("position")
      expect(node).not.toHaveProperty("shape")
    }
    expect(workflow).toEqual(before)
  })

  it("keeps annotations outside the semantic workflow", () => {
    const state = createInitialEditorState(workflowWithTypes())
    const snapshot = { ...state.present, annotations: [{ id: "note-1", text: "Note", position: { x: 10, y: 20 } }] }
    expect(snapshot.annotations).toHaveLength(1)
    expect(snapshot.workflow).not.toHaveProperty("annotations")
  })

  it("retries UUID generation after a forced collision", () => {
    const generator = vi.fn().mockReturnValueOnce("collision").mockReturnValueOnce("unique")
    const existing = new Set(["node-collision"])
    expect(createUniqueEditorId("node", existing, generator)).toBe("node-unique")
    expect(generator).toHaveBeenCalledTimes(2)
    expect(existing).toEqual(new Set(["node-collision"]))
  })

  it("records a snapshot transaction and clears redo", () => {
    const initial = createInitialEditorState(workflowWithTypes())
    const next = renamedSnapshot(initial.present, "Changed")
    const state = editorReducer({ ...initial, future: [renamedSnapshot(initial.present, "Future")] }, { type: "snapshot/record", snapshot: next })
    expect(state.past).toEqual([initial.present])
    expect(state.present).toBe(next)
    expect(state.future).toEqual([])
  })

  it("does not record transient actions", () => {
    const initial = createInitialEditorState(workflowWithTypes())
    const selected = editorReducer(initial, { type: "selection/set", selection: { kind: "node", nodeId: "node-1" } })
    const tooled = editorReducer(selected, { type: "tool/set", tool: "connector" })
    const loading = editorReducer(tooled, { type: "async/set", asyncState: { status: "loading" } })
    const issued = editorReducer(loading, { type: "issues/set", issues: [] })
    expect(issued.past).toEqual([])
    expect(issued.future).toEqual([])
    expect(issued.present).toBe(initial.present)
  })

  it("undoes and redoes snapshots", () => {
    const initial = createInitialEditorState(workflowWithTypes())
    const changed = renamedSnapshot(initial.present, "Changed")
    const recorded = editorReducer(initial, { type: "snapshot/record", snapshot: changed })
    const undone = editorReducer(recorded, { type: "history/undo" })
    const redone = editorReducer(undone, { type: "history/redo" })
    expect(undone.present).toBe(initial.present)
    expect(redone.present).toBe(changed)
  })

  it("clears the future when recording a branch after undo", () => {
    const initial = createInitialEditorState(workflowWithTypes())
    const first = renamedSnapshot(initial.present, "First")
    const recorded = editorReducer(initial, { type: "snapshot/record", snapshot: first })
    const undone = editorReducer(recorded, { type: "history/undo" })
    const branch = renamedSnapshot(undone.present, "Branch")
    const branched = editorReducer(undone, { type: "snapshot/record", snapshot: branch })
    expect(branched.future).toEqual([])
    expect(branched.present.workflow.title).toBe("Branch")
  })

  it("caps past history at 100 snapshots", () => {
    let state = createInitialEditorState(workflowWithTypes())
    for (let index = 1; index <= 105; index += 1) {
      state = editorReducer(state, { type: "snapshot/record", snapshot: renamedSnapshot(state.present, `Change ${index}`) })
    }
    expect(state.past).toHaveLength(100)
    expect(state.past[0].workflow.title).toBe("Change 5")
  })

  it("preserves selection, tool, and async state across history navigation", () => {
    const initial = createInitialEditorState(workflowWithTypes())
    const transient = {
      ...initial,
      selection: { kind: "node", nodeId: "node-1" } as const,
      activeTool: "text" as const,
      asyncState: { status: "error", message: "Try again." } as const,
    }
    const recorded = editorReducer(transient, { type: "snapshot/record", snapshot: renamedSnapshot(initial.present, "Changed") })
    const undone = editorReducer(recorded, { type: "history/undo" })
    expect(undone.selection).toEqual(transient.selection)
    expect(undone.activeTool).toBe("text")
    expect(undone.asyncState).toEqual(transient.asyncState)
  })

  it("does not mutate prior reducer state or snapshots", () => {
    const initial = createInitialEditorState(workflowWithTypes())
    const before = structuredClone(initial)
    const nextSnapshot = createEditorSnapshot({ ...initial.present.workflow, title: "Changed" })
    const next = editorReducer(initial, { type: "snapshot/record", snapshot: nextSnapshot })
    expect(initial).toEqual(before)
    expect(next).not.toBe(initial)
    expect(next.past[0]).toBe(initial.present)
  })
})
