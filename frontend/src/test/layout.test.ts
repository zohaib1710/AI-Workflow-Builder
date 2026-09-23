import { describe, expect, it } from "vitest"
import type { Workflow } from "../types/workflow"
import { layoutWorkflow, WORKFLOW_NODE_HEIGHT, WORKFLOW_NODE_WIDTH } from "../lib/layout"
import { FLOWCHART_SHAPES } from "../components/editor/nodes/shapeRegistry"
import { DEFAULT_SHAPE_BY_NODE_TYPE } from "../editor/types"
import { findNearestClearNodePosition } from "../editor/nodePlacement"

function linearWorkflow(): Workflow {
  return {
    title: "Lead qualification",
    description: "Qualifies leads.",
    nodes: [
      { id: "start", type: "start", title: "Receive lead", description: "A lead arrives.", application: null },
      { id: "check", type: "decision", title: "Existing contact?", description: "Check the CRM.", application: "CRM" },
      { id: "end", type: "end", title: "Finish", description: "Complete the process.", application: null },
    ],
    edges: [
      { id: "edge-yes", source: "start", target: "check", label: "Yes" },
      { id: "edge-no", source: "check", target: "end", label: "No" },
    ],
  }
}

describe("layoutWorkflow", () => {
  it("returns deterministic left-to-right positions without mutating input", () => {
    const workflow = linearWorkflow()
    const before = JSON.parse(JSON.stringify(workflow))
    const first = layoutWorkflow(workflow)
    const second = layoutWorkflow(JSON.parse(JSON.stringify(workflow)) as Workflow)

    expect(workflow).toEqual(before)
    expect(first).toEqual(second)
    expect(first.nodes.map((node) => node.id)).toEqual(["start", "check", "end"])
    expect(first.nodes.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true)
    expect(first.nodes.every((node) => node.draggable === false && node.connectable === false && node.selectable === false && node.deletable === false)).toBe(true)
    expect(first.nodes[0].position.x).toBeLessThan(first.nodes[1].position.x)
    expect(first.nodes[1].position.x).toBeLessThan(first.nodes[2].position.x)
  })

  it("preserves node data, edge order, IDs, endpoints, and labels", () => {
    const result = layoutWorkflow(linearWorkflow())
    expect(result.nodes[1].data).toEqual({ nodeType: "decision", title: "Existing contact?", description: "Check the CRM.", application: "CRM" })
    expect(result.edges.map((edge) => edge.id)).toEqual(["edge-yes", "edge-no"])
    expect(result.edges.map((edge) => [edge.source, edge.target, edge.label])).toEqual([["start", "check", "Yes"], ["check", "end", "No"]])
  })

  it("lays out a single node without inventing edges", () => {
    const workflow = linearWorkflow()
    workflow.nodes = [workflow.nodes[0]]
    workflow.edges = []
    const result = layoutWorkflow(workflow)
    expect(result.nodes).toHaveLength(1)
    expect(result.edges).toEqual([])
    expect(result.nodes[0].position).toEqual({ x: 48, y: 48 })
  })

  it("preserves parallel edges and separates decision branches", () => {
    const workflow = linearWorkflow()
    workflow.nodes.push({ id: "yes", type: "action", title: "Yes path", description: "Continue.", application: null })
    workflow.nodes.push({ id: "no", type: "action", title: "No path", description: "Stop.", application: null })
    workflow.edges = [
      { id: "branch-yes", source: "check", target: "yes", label: "Yes" },
      { id: "branch-no", source: "check", target: "no", label: "No" },
      { id: "parallel", source: "check", target: "yes", label: "Also yes" },
    ]
    const result = layoutWorkflow(workflow)
    expect(result.edges.map((edge) => edge.id)).toEqual(["branch-yes", "branch-no", "parallel"])
    expect(result.edges.map((edge) => edge.label)).toEqual(["Yes", "No", "Also yes"])
    expect(result.nodes.find((node) => node.id === "yes")?.position).not.toEqual(result.nodes.find((node) => node.id === "no")?.position)
  })

  it("keeps coordinates in view-layer output only", () => {
    const workflow = linearWorkflow()
    const result = layoutWorkflow(workflow)
    expect(workflow.nodes[0]).not.toHaveProperty("position")
    expect(result.nodes[0].position).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }))
    expect(result.nodes[0].data).not.toHaveProperty("position")
    expect(WORKFLOW_NODE_WIDTH).toBe(280)
    expect(WORKFLOW_NODE_HEIGHT).toBe(180)
  })

  it("keeps a long branching workflow collision-free with label-aware rank spacing", () => {
    const workflow: Workflow = {
      title: "Sales workflow",
      description: "A representative branching workflow.",
      nodes: [
        { id: "start", type: "start", title: "Lead arrives", description: "Receive lead.", application: null },
        { id: "qualify", type: "decision", title: "Qualified?", description: "Check fit.", application: "CRM" },
        { id: "nurture", type: "notification", title: "Nurture", description: "Send follow-up.", application: "Email" },
        { id: "proposal", type: "action", title: "Proposal", description: "Prepare proposal.", application: "CRM" },
        { id: "approval", type: "approval", title: "Approved?", description: "Manager review.", application: null },
        { id: "revise", type: "action", title: "Revise", description: "Revise proposal.", application: null },
        { id: "sign", type: "api", title: "Send for signature", description: "Request signature.", application: "DocuSign" },
        { id: "end", type: "end", title: "Complete", description: "Close workflow.", application: null },
      ],
      edges: [
        { id: "e1", source: "start", target: "qualify", label: null },
        { id: "e2", source: "qualify", target: "nurture", label: "Not qualified" },
        { id: "e3", source: "qualify", target: "proposal", label: "Qualified" },
        { id: "e4", source: "proposal", target: "approval", label: "Proposal ready" },
        { id: "e5", source: "approval", target: "revise", label: "Changes requested" },
        { id: "e6", source: "revise", target: "approval", label: "Revised proposal" },
        { id: "e7", source: "approval", target: "sign", label: "Approved" },
        { id: "e8", source: "sign", target: "end", label: "Signed" },
        { id: "e9", source: "nurture", target: "end", label: "Nurture complete" },
      ],
    }
    const result = layoutWorkflow(workflow)

    for (let index = 0; index < result.nodes.length; index += 1) {
      const left = result.nodes[index]
      const leftShape = FLOWCHART_SHAPES[DEFAULT_SHAPE_BY_NODE_TYPE[left.data.nodeType]]
      for (const right of result.nodes.slice(index + 1)) {
        const rightShape = FLOWCHART_SHAPES[DEFAULT_SHAPE_BY_NODE_TYPE[right.data.nodeType]]
        const intersects = left.position.x < right.position.x + rightShape.width
          && left.position.x + leftShape.width > right.position.x
          && left.position.y < right.position.y + rightShape.height
          && left.position.y + leftShape.height > right.position.y
        expect(intersects, `${left.id} overlaps ${right.id}`).toBe(false)
      }
    }

    const proposal = result.nodes.find((node) => node.id === "proposal")!
    const approval = result.nodes.find((node) => node.id === "approval")!
    expect(approval.position.x - proposal.position.x).toBeGreaterThan(300)
  })

  it("moves a manual drop to the nearest tested clear position", () => {
    const occupied = {
      start: { nodeId: "start", shape: "terminator" as const, position: { x: 100, y: 100 } },
    }
    const position = findNearestClearNodePosition(
      { x: 120, y: 120 },
      "process",
      occupied,
      "moving",
    )
    const moving = FLOWCHART_SHAPES.process
    const fixed = FLOWCHART_SHAPES.terminator
    const intersects = position.x < occupied.start.position.x + fixed.width
      && position.x + moving.width > occupied.start.position.x
      && position.y < occupied.start.position.y + fixed.height
      && position.y + moving.height > occupied.start.position.y
    expect(intersects).toBe(false)
  })
})
