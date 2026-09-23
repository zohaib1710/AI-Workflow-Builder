import { describe, expect, it } from "vitest"
import type { Workflow } from "../types/workflow"
import { layoutWorkflow, WORKFLOW_NODE_HEIGHT, WORKFLOW_NODE_WIDTH } from "../lib/layout"

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
    expect(result.nodes[0].position).toEqual({ x: 30, y: 30 })
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
    expect(WORKFLOW_NODE_HEIGHT).toBe(170)
  })
})
