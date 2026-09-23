import { describe, expect, it } from "vitest"
import { validateWorkflowDraft } from "../editor/validation"
import type { Workflow } from "../types/workflow"

function validWorkflow(): Workflow {
  return {
    title: "Review request",
    description: "Routes a request for review.",
    nodes: [
      { id: "start", type: "start", title: "Start", description: "Receive request.", application: null },
      { id: "decision", type: "decision", title: "Review", description: "Review request.", application: null },
      { id: "approved", type: "end", title: "Approved", description: "Approve request.", application: null },
      { id: "rejected", type: "end", title: "Rejected", description: "Reject request.", application: null },
    ],
    edges: [
      { id: "to-review", source: "start", target: "decision", label: null },
      { id: "yes", source: "decision", target: "approved", label: "Yes" },
      { id: "no", source: "decision", target: "rejected", label: "No" },
    ],
  }
}

function copy(workflow: Workflow): Workflow {
  return structuredClone(workflow)
}

function codes(workflow: Workflow): string[] {
  return validateWorkflowDraft(workflow).map((issue) => issue.code)
}

describe("validateWorkflowDraft", () => {
  it("accepts a valid workflow", () => {
    expect(validateWorkflowDraft(validWorkflow())).toEqual([])
  })

  it.each([
    ["duplicate node ID", "duplicate_node_id", (workflow: Workflow) => { workflow.nodes.push({ ...workflow.nodes[0] }) }],
    ["duplicate edge ID", "duplicate_edge_id", (workflow: Workflow) => { workflow.edges.push({ ...workflow.edges[0] }) }],
    ["missing source", "missing_source_node", (workflow: Workflow) => { workflow.edges[0].source = "missing" }],
    ["missing target", "missing_target_node", (workflow: Workflow) => { workflow.edges[0].target = "missing" }],
    ["self-reference", "self_referencing_edge", (workflow: Workflow) => { workflow.edges[0].target = "start" }],
    ["incoming start edge", "start_node_has_incoming_edge", (workflow: Workflow) => { workflow.edges.push({ id: "back", source: "approved", target: "start", label: null }) }],
    ["outgoing end edge", "end_node_has_outgoing_edge", (workflow: Workflow) => { workflow.edges.push({ id: "after-end", source: "approved", target: "rejected", label: null }) }],
    ["decision fan-out", "decision_requires_multiple_paths", (workflow: Workflow) => { workflow.edges = workflow.edges.filter((edge) => edge.id !== "no") }],
    ["decision branch label", "decision_edge_label_required", (workflow: Workflow) => { workflow.edges.find((edge) => edge.id === "yes")!.label = "  " }],
    ["disconnected graph", "disconnected_graph", (workflow: Workflow) => { workflow.nodes.push({ id: "isolated", type: "action", title: "Isolated", description: "No connection.", application: null }) }],
  ])("detects %s", (_name, expectedCode, change) => {
    const workflow = validWorkflow()
    change(workflow)
    expect(codes(workflow)).toContain(expectedCode)
  })

  it("accepts a valid single-node workflow", () => {
    const workflow = validWorkflow()
    workflow.nodes = [workflow.nodes[0]]
    workflow.edges = []
    expect(validateWorkflowDraft(workflow)).toEqual([])
  })

  it("returns multiple practical issues in stable category order", () => {
    const workflow = validWorkflow()
    workflow.nodes.push({ ...workflow.nodes[0] })
    workflow.edges.push({ ...workflow.edges[0] })
    workflow.edges.push({ id: "invalid", source: "missing", target: "also-missing", label: null })

    const first = codes(workflow)
    const second = codes(copy(workflow))
    expect(first).toEqual(second)
    expect(first.slice(0, 4)).toEqual([
      "duplicate_node_id", "duplicate_edge_id", "missing_source_node", "missing_target_node",
    ])
    expect(first).toHaveLength(4)
  })

  it("does not mutate the workflow", () => {
    const workflow = validWorkflow()
    const before = copy(workflow)
    validateWorkflowDraft(workflow)
    expect(workflow).toEqual(before)
  })
})
