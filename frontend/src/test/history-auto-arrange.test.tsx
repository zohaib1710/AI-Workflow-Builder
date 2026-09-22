import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import EditorToolbar from "../components/editor/EditorToolbar"
import WorkflowEditorCanvas from "../components/editor/WorkflowEditorCanvas"
import { EditorProvider, useEditorDispatch, useEditorState } from "../editor/EditorContext"
import { createInitialEditorState, editorReducer, type EditorAction } from "../editor/editorReducer"
import { autoArrangePresentation } from "../editor/presentation"
import type { CanvasNodePresentation, EditorSnapshot, EditorState } from "../editor/types"
import type { Workflow } from "../types/workflow"

const flowFitView = vi.hoisted(() => vi.fn())
const contextFitView = vi.hoisted(() => vi.fn())
const setFlowNodes = vi.hoisted(() => vi.fn())

vi.mock("@xyflow/react", async () => {
  const React = await import("react")
  return {
    Handle: () => <span />,
    Position: { Left: "left", Right: "right" },
    ReactFlow: ({
      children,
      onInit,
    }: {
      children?: ReactNode
      onInit: (instance: unknown) => void
    }) => {
      React.useEffect(() => {
        onInit({
          fitView: flowFitView,
          screenToFlowPosition: (position: { x: number; y: number }) => position,
          setNodes: setFlowNodes,
        })
      }, [onInit])
      return <div data-testid="react-flow">{children}</div>
    },
    Background: () => <span />,
    Controls: () => <span />,
    MiniMap: () => <span />,
    useNodesInitialized: () => true,
    useReactFlow: () => ({ fitView: contextFitView }),
  }
})

afterEach(() => {
  cleanup()
  flowFitView.mockReset()
  contextFitView.mockReset()
  setFlowNodes.mockReset()
})

function workflowFixture(): Workflow {
  return {
    title: "Review workflow",
    description: "Reviews a request.",
    nodes: [
      { id: "start", type: "start", title: "Start", description: "Start.", application: null },
      { id: "review", type: "action", title: "Review", description: "Review.", application: null },
      { id: "end", type: "end", title: "End", description: "End.", application: null },
    ],
    edges: [
      { id: "edge-1", source: "start", target: "review", label: null },
      { id: "edge-2", source: "review", target: "end", label: null },
    ],
    assumptions: [],
    missingRequirements: [],
    suggestions: [],
  }
}

function manualState(): EditorState {
  const initial = createInitialEditorState(workflowFixture())
  return {
    ...initial,
    present: {
      ...initial.present,
      nodePresentations: {
        ...initial.present.nodePresentations,
        start: {
          nodeId: "start",
          shape: "document",
          position: { x: 700, y: 500 },
        },
        review: {
          ...initial.present.nodePresentations.review,
          position: { x: 80, y: 600 },
        },
      },
      annotations: [
        { id: "note", text: "Keep me", position: { x: 910, y: 120 } },
      ],
    },
  }
}

function arrange(state: EditorState): EditorState {
  const nodePresentations = autoArrangePresentation(
    state.present.workflow,
    state.present.nodePresentations,
  )
  if (nodePresentations === state.present.nodePresentations) return state
  return editorReducer(state, {
    type: "snapshot/record",
    snapshot: { ...state.present, nodePresentations },
  })
}

function ToolbarProbe() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  if (!state) return null
  return (
    <>
      <output data-testid="history-state">
        {JSON.stringify({
          past: state.past.length,
          future: state.future.length,
          position: state.present.nodePresentations.start.position,
        })}
      </output>
      <button
        type="button"
        onClick={() => dispatch({
          type: "node/position-commit",
          nodeId: "start",
          position: { x: 900, y: 700 },
        })}
      >
        Move node
      </button>
      <button
        type="button"
        onClick={() => dispatch({
          type: "async/set",
          asyncState: { status: "loading" },
        })}
      >
        Set loading
      </button>
    </>
  )
}

function historyState(): {
  past: number
  future: number
  position: { x: number; y: number }
} {
  return JSON.parse(screen.getByTestId("history-state").textContent ?? "{}")
}

describe("history and Auto Arrange", () => {
  it("replaces only semantic-node positions in one recorded transaction", () => {
    const before = manualState()
    const arranged = arrange(before)

    expect(arranged.present.workflow).toBe(before.present.workflow)
    expect(arranged.present.annotations).toBe(before.present.annotations)
    expect(arranged.present.nodePresentations.start.shape).toBe("document")
    expect(arranged.present.nodePresentations.start.position).not.toEqual(
      before.present.nodePresentations.start.position,
    )
    expect(arranged.present.nodePresentations.review.position).not.toEqual(
      before.present.nodePresentations.review.position,
    )
    expect(arranged.past).toEqual([before.present])
    expect(arranged.future).toEqual([])
  })

  it("undoes and redoes an entire arranged presentation as one step", () => {
    const before = manualState()
    const arranged = arrange(before)
    const arrangedPositions = structuredClone(arranged.present.nodePresentations)

    const undone = editorReducer(arranged, { type: "history/undo" })
    expect(undone.present).toBe(before.present)
    expect(undone.present.nodePresentations).toEqual(before.present.nodePresentations)

    const redone = editorReducer(undone, { type: "history/redo" })
    expect(redone.present.nodePresentations).toEqual(arrangedPositions)
    expect(redone.past).toHaveLength(1)
    expect(redone.future).toEqual([])
  })

  it.each([
    {
      label: "an empty workflow",
      workflow: {
        ...workflowFixture(),
        nodes: [],
        edges: [],
      } satisfies Workflow,
      presentation: {} as Record<string, CanvasNodePresentation>,
      expectedIds: [] as string[],
    },
    {
      label: "a single node",
      workflow: {
        ...workflowFixture(),
        nodes: [workflowFixture().nodes[0]],
        edges: [],
      } satisfies Workflow,
      presentation: {
        start: {
          nodeId: "start",
          shape: "manual-operation",
          position: { x: 800, y: 600 },
        },
      } as Record<string, CanvasNodePresentation>,
      expectedIds: ["start"],
    },
    {
      label: "a structurally unsafe invalid draft",
      workflow: {
        ...workflowFixture(),
        edges: [
          { id: "unlabeled", source: "start", target: "review", label: null },
          { id: "missing", source: "review", target: "missing-node", label: null },
        ],
      } satisfies Workflow,
      presentation: {} as Record<string, CanvasNodePresentation>,
      expectedIds: ["start", "review", "end"],
    },
  ])("handles $label deterministically without mutating inputs", ({
    workflow,
    presentation,
    expectedIds,
  }) => {
    const before = structuredClone({ workflow, presentation })
    const first = autoArrangePresentation(workflow, presentation)
    const second = autoArrangePresentation(workflow, presentation)

    expect({ workflow, presentation }).toEqual(before)
    expect(second).toEqual(first)
    for (const id of expectedIds) {
      expect(Number.isFinite(first[id].position.x)).toBe(true)
      expect(Number.isFinite(first[id].position.y)).toBe(true)
    }
    if (workflow.nodes.length === 0) expect(first).toBe(presentation)
  })

  it("exposes synchronized history controls and fits once after a meaningful arrange", async () => {
    render(
      <EditorProvider workflow={workflowFixture()}>
        <WorkflowEditorCanvas editingViewport />
        <EditorToolbar editingViewport onNewWorkflow={() => undefined} />
        <ToolbarProbe />
      </EditorProvider>,
    )

    expect(screen.getByRole("button", { name: "Auto Arrange" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Auto Arrange" }))
    expect(historyState().past).toBe(0)
    expect(flowFitView).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Move node" }))
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Redo" }))

    fireEvent.click(screen.getByRole("button", { name: "Auto Arrange" }))
    await waitFor(() => expect(flowFitView).toHaveBeenCalledTimes(1))
    expect(historyState().past).toBe(2)
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Set loading" }))
    expect(screen.getByRole("button", { name: "Auto Arrange" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
  })

  it.each([
    [
      "manual presentation",
      (_state: EditorState): EditorAction => ({
        type: "node/position-commit",
        nodeId: "start",
        position: { x: 500, y: 400 },
      }),
    ],
    [
      "semantic edit",
      (state: EditorState): EditorAction => ({
        type: "node/semantic-commit",
        nodeId: "review",
        fields: { title: state.present.workflow.nodes[1].title + " revised" },
      }),
    ],
    [
      "annotation",
      (_state: EditorState): EditorAction => ({
        type: "annotation/create",
        annotation: { id: "note", text: "Note", position: { x: 10, y: 20 } },
      }),
    ],
    [
      "AI snapshot adoption",
      (state: EditorState): EditorAction => ({
        type: "snapshot/record",
        snapshot: {
          ...state.present,
          workflow: { ...state.present.workflow, title: "AI revised" },
        },
      }),
    ],
  ] as const)("keeps a representative %s action to one history step", (_label, actionFor) => {
    const initial = createInitialEditorState(workflowFixture())
    const next = editorReducer(initial, actionFor(initial))
    expect(next.past).toHaveLength(1)
    expect(next.past[0]).toBe(initial.present)
  })

  it("keeps transient state out of history and clears redo after a branch", () => {
    const initial = createInitialEditorState(workflowFixture())
    const selected = editorReducer(initial, {
      type: "selection/set",
      selection: { kind: "node", nodeId: "review" },
    })
    const tooled = editorReducer(selected, { type: "tool/set", tool: "text" })
    const errored = editorReducer(tooled, {
      type: "async/set",
      asyncState: { status: "error", message: "Try again." },
    })
    expect(errored.past).toEqual([])
    expect(errored.present).toBe(initial.present)
    expect(errored).not.toHaveProperty("viewport")
    expect(errored).not.toHaveProperty("prompt")

    const changedSnapshot: EditorSnapshot = {
      ...errored.present,
      workflow: { ...errored.present.workflow, title: "First change" },
    }
    const recorded = editorReducer(errored, {
      type: "snapshot/record",
      snapshot: changedSnapshot,
    })
    const undone = editorReducer(recorded, { type: "history/undo" })
    const branched = editorReducer(undone, {
      type: "node/semantic-commit",
      nodeId: "review",
      fields: { title: "Branch review" },
    })

    expect(branched.future).toEqual([])
    expect(branched.past).toHaveLength(1)
    expect(branched.selection).toEqual({ kind: "node", nodeId: "review" })
    expect(branched.activeTool).toBe("text")
    expect(branched.asyncState).toEqual({ status: "error", message: "Try again." })
  })
})
