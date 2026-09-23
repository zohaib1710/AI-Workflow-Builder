import { describe, expect, it } from "vitest"
import { reconcileWorkflowPresentation } from "../editor/reconcileWorkflow"
import {
  DEFAULT_SHAPE_BY_NODE_TYPE,
  type CanvasNodePresentation,
  type FlowchartShape,
} from "../editor/types"
import type {
  SupportedNodeType,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from "../types/workflow"

function node(
  id: string,
  type: SupportedNodeType = "action",
  title = id,
): WorkflowNode {
  return {
    id,
    type,
    title,
    description: `Describe ${id}.`,
    application: null,
  }
}

function edge(id: string, source: string, target: string): WorkflowEdge {
  return { id, source, target, label: null }
}

function workflow(nodes: WorkflowNode[], edges: WorkflowEdge[] = []): Workflow {
  return {
    title: "Workflow",
    description: "A workflow.",
    nodes,
    edges,
  }
}

function presentation(
  nodeId: string,
  x: number,
  y: number,
  shape: FlowchartShape = "manual-operation",
): CanvasNodePresentation {
  return { nodeId, shape, position: { x, y } }
}

function expectOk(
  result: ReturnType<typeof reconcileWorkflowPresentation>,
): Record<string, CanvasNodePresentation> {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Expected successful reconciliation")
  return result.presentation
}

describe("reconcileWorkflowPresentation", () => {
  it("preserves position and shape when same-ID semantic fields change", () => {
    const previous = workflow([node("retained")])
    const revised = workflow([{
      ...node("retained", "decision", "Renamed"),
      description: "Changed.",
      application: "CRM",
    }])
    const previousPresentation = {
      retained: presentation("retained", 120, 80, "document"),
    }

    const result = expectOk(reconcileWorkflowPresentation(
      previous,
      previousPresentation,
      revised,
      { x: 0, y: 0 },
    ))

    expect(result.retained).toEqual(previousPresentation.retained)
    expect(result.retained).not.toBe(previousPresentation.retained)
  })

  it("omits presentation for deleted semantic nodes", () => {
    const result = expectOk(reconcileWorkflowPresentation(
      workflow([node("keep"), node("delete")]),
      {
        keep: presentation("keep", 10, 20),
        delete: presentation("delete", 370, 20),
      },
      workflow([node("keep")]),
      { x: 0, y: 0 },
    ))

    expect(Object.keys(result)).toEqual(["keep"])
  })

  it.each([
    {
      label: "after a retained predecessor",
      previous: workflow([node("anchor")]),
      revised: workflow(
        [node("anchor"), node("new", "notification")],
        [edge("e1", "anchor", "new")],
      ),
      previousPresentation: { anchor: presentation("anchor", 100, 50) },
      center: { x: 900, y: 900 },
      expected: { x: 460, y: 50 },
    },
    {
      label: "before a retained successor",
      previous: workflow([node("anchor")]),
      revised: workflow(
        [node("new", "notification"), node("anchor")],
        [edge("e1", "new", "anchor")],
      ),
      previousPresentation: { anchor: presentation("anchor", 100, 50) },
      center: { x: 900, y: 900 },
      expected: { x: -260, y: 50 },
    },
    {
      label: "at the canvas center without a retained neighbor",
      previous: workflow([]),
      revised: workflow([node("new", "notification")]),
      previousPresentation: {},
      center: { x: 40, y: 60 },
      expected: { x: 40, y: 60 },
    },
  ])("places a new node $label", ({
    previous,
    revised,
    previousPresentation,
    center,
    expected,
  }) => {
    const result = expectOk(reconcileWorkflowPresentation(
      previous,
      previousPresentation as Record<string, CanvasNodePresentation>,
      revised,
      center,
    ))

    expect(result.new.position).toEqual(expected)
    expect(result.new.shape).toBe(DEFAULT_SHAPE_BY_NODE_TYPE.notification)
  })

  it("resolves shared-anchor collisions downward in revised node order", () => {
    const previous = workflow([node("anchor")])
    const revised = workflow(
      [node("anchor"), node("first"), node("second")],
      [edge("e1", "anchor", "first"), edge("e2", "anchor", "second")],
    )

    const result = expectOk(reconcileWorkflowPresentation(
      previous,
      { anchor: presentation("anchor", 100, 50) },
      revised,
      { x: 0, y: 0 },
    ))

    expect(result.first.position).toEqual({ x: 460, y: 50 })
    expect(result.second.position).toEqual({ x: 460, y: 270 })
  })

  it("is deterministic for identical inputs", () => {
    const previous = workflow([node("anchor")])
    const revised = workflow(
      [node("anchor"), node("new")],
      [edge("e1", "anchor", "new")],
    )
    const previousPresentation = {
      anchor: presentation("anchor", 10, 20),
    }

    const first = reconcileWorkflowPresentation(
      previous,
      previousPresentation,
      revised,
      { x: 0, y: 0 },
    )
    const second = reconcileWorkflowPresentation(
      previous,
      previousPresentation,
      revised,
      { x: 0, y: 0 },
    )

    expect(second).toEqual(first)
  })

  it("does not mutate workflow, presentation, or center inputs", () => {
    const previous = workflow([node("anchor")])
    const revised = workflow(
      [node("anchor"), node("new")],
      [edge("e1", "anchor", "new")],
    )
    const previousPresentation = {
      anchor: presentation("anchor", 10, 20),
    }
    const center = { x: 500, y: 400 }
    const before = structuredClone({
      previous,
      revised,
      previousPresentation,
      center,
    })

    reconcileWorkflowPresentation(
      previous,
      previousPresentation,
      revised,
      center,
    )

    expect({ previous, revised, previousPresentation, center }).toEqual(before)
  })

  it("returns identity instability for two nonempty workflows with zero shared IDs", () => {
    const result = reconcileWorkflowPresentation(
      workflow([node("old")]),
      { old: presentation("old", 10, 20) },
      workflow([node("replacement")]),
      { x: 0, y: 0 },
    )

    expect(result).toEqual({ status: "identity-instability" })
  })

  it("supports partial ID churn while preserving retained presentation", () => {
    const retainedPresentation = presentation("keep", 70, 90, "predefined-process")
    const result = expectOk(reconcileWorkflowPresentation(
      workflow([node("keep"), node("removed")]),
      {
        keep: retainedPresentation,
        removed: presentation("removed", 430, 90),
      },
      workflow(
        [node("keep", "database"), node("new", "database")],
        [edge("e1", "keep", "new")],
      ),
      { x: 0, y: 0 },
    ))

    expect(result.keep).toEqual(retainedPresentation)
    expect(result).not.toHaveProperty("removed")
    expect(result.new.shape).toBe(DEFAULT_SHAPE_BY_NODE_TYPE.database)
  })

  it("creates default presentation when a shared ID lacks prior presentation", () => {
    const result = expectOk(reconcileWorkflowPresentation(
      workflow([node("shared", "api")]),
      {},
      workflow([node("shared", "api")]),
      { x: 25, y: 35 },
    ))

    expect(result.shared).toEqual({
      nodeId: "shared",
      shape: DEFAULT_SHAPE_BY_NODE_TYPE.api,
      position: { x: 25, y: 35 },
    })
  })

  it.each([
    [workflow([]), workflow([])],
    [workflow([node("old")]), workflow([])],
  ])("reconciles an empty revised presentation safely", (previous, revised) => {
    const result = expectOk(reconcileWorkflowPresentation(
      previous,
      { old: presentation("old", 10, 20) },
      revised,
      { x: 0, y: 0 },
    ))

    expect(result).toEqual({})
  })
})
