import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Workflow } from "../types/workflow"
import type { NodeProps } from "@xyflow/react"
import type { WorkflowFlowNode } from "../components/nodes/nodeTypes"
import WorkflowNode from "../components/nodes/WorkflowNode"
import WorkflowCanvas, { buildFlowEdges, buildFlowNodes } from "../components/WorkflowCanvas"
import { supportedNodeTypes, workflowNodeTypes, workflowVisualConfig } from "../components/nodes/nodeTypes"

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, position }: { type: string; position: string }) => <span data-testid={`${type}-${position}`} />,
  Position: { Left: "left", Right: "right" },
  ReactFlow: (props: { children?: ReactNode; fitView?: boolean; nodesDraggable?: boolean; nodesConnectable?: boolean; elementsSelectable?: boolean; nodesFocusable?: boolean; edgesFocusable?: boolean; deleteKeyCode?: null; nodes?: { id: string }[]; edges?: { id: string; label?: ReactNode }[] }) => (
    <div data-testid="react-flow" data-fit-view={String(props.fitView)} data-nodes-draggable={String(props.nodesDraggable)} data-nodes-connectable={String(props.nodesConnectable)} data-elements-selectable={String(props.elementsSelectable)} data-nodes-focusable={String(props.nodesFocusable)} data-edges-focusable={String(props.edgesFocusable)} data-delete-key-code={String(props.deleteKeyCode)}>
      {props.edges?.map((edge) => <span key={edge.id}>{edge.label}</span>)}
      {props.children}
    </div>
  ),
  Background: () => <span data-testid="background" />,
  Controls: () => <span data-testid="controls" />,
  MiniMap: () => <span data-testid="minimap" />,
  useNodesInitialized: () => true,
  useReactFlow: () => ({ fitView: vi.fn() }),
}))

const nodeTypes = [...supportedNodeTypes]
afterEach(cleanup)

function nodeProps(type: (typeof nodeTypes)[number], application: string | null = "CRM"): NodeProps<WorkflowFlowNode> {
  return { id: type, data: { nodeType: type, title: "Node title", description: "Node description", application }, type, dragging: false, draggable: false, deletable: false, zIndex: 0, isConnectable: false, selectable: false, selected: false, positionAbsoluteX: 0, positionAbsoluteY: 0 }
}

function sampleWorkflow(): Workflow {
  return {
    title: "Lead workflow", description: "Qualifies leads.",
    nodes: nodeTypes.map((type) => ({ id: type, type, title: `${workflowVisualConfig[type].label} step`, description: `Description for ${type}.`, application: type === "start" ? null : "Example system" })),
    edges: [{ id: "edge-yes", source: "decision", target: "action", label: "Yes" }, { id: "edge-no", source: "decision", target: "end", label: "No" }],
    assumptions: [], missingRequirements: [], suggestions: [],
  }
}

describe("workflow node registry", () => {
  it("contains exactly all supported node types", () => {
    expect(Object.keys(workflowNodeTypes).sort()).toEqual([...nodeTypes].sort())
  })

  it("renders every supported node with safe text content", () => {
    for (const type of nodeTypes) {
      const { unmount } = render(<WorkflowNode {...nodeProps(type)} />)
      expect(screen.getByText(workflowVisualConfig[type].label)).toBeInTheDocument()
      expect(screen.getByText("Node title")).toBeInTheDocument()
      expect(screen.getByText("Node description")).toBeInTheDocument()
      expect(screen.getByText("Application:")).toBeInTheDocument()
      expect(screen.getByText("CRM")).toBeInTheDocument()
      unmount()
    }
  })

  it("uses correct handles for boundary and regular nodes", () => {
    const { rerender } = render(<WorkflowNode {...nodeProps("start")} />)
    expect(screen.queryByTestId("target-left")).not.toBeInTheDocument()
    expect(screen.getByTestId("source-right")).toBeInTheDocument()
    rerender(<WorkflowNode {...nodeProps("end")} />)
    expect(screen.getByTestId("target-left")).toBeInTheDocument()
    expect(screen.queryByTestId("source-right")).not.toBeInTheDocument()
    rerender(<WorkflowNode {...nodeProps("action")} />)
    expect(screen.getByTestId("target-left")).toBeInTheDocument()
    expect(screen.getByTestId("source-right")).toBeInTheDocument()
  })

  it("omits null applications and renders suspicious values as text", () => {
    const { rerender } = render(<WorkflowNode {...nodeProps("wait", null)} />)
    expect(screen.queryByText(/Application:/)).not.toBeInTheDocument()
    rerender(<WorkflowNode {...nodeProps("wait")} data={{ nodeType: "wait", title: "<script>alert('x')</script>", description: "plain", application: "CRM" }} />)
    expect(screen.getByText("<script>alert('x')</script>")).toBeInTheDocument()
  })
})

describe("workflow canvas conversion", () => {
  it("preserves order, read-only flags, temporary positions, and edge labels", () => {
    const workflow = sampleWorkflow()
    const nodes = buildFlowNodes(workflow).nodes
    const edges = buildFlowEdges(workflow)
    expect(nodes.map((node) => node.id)).toEqual(nodeTypes)
    expect(nodes.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true)
    expect(nodes.every((node) => node.draggable === false && node.connectable === false && node.selectable === false && node.deletable === false)).toBe(true)
    expect(edges.map((edge) => edge.label)).toEqual(["Yes", "No"])
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([["decision", "action"], ["decision", "end"]])
  })

  it("renders navigation and read-only canvas settings", () => {
    render(<WorkflowCanvas workflow={sampleWorkflow()} />)
    expect(screen.getByTestId("background")).toBeInTheDocument()
    expect(screen.getByTestId("controls")).toBeInTheDocument()
    expect(screen.getByTestId("minimap")).toBeInTheDocument()
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-fit-view", "true")
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-nodes-draggable", "false")
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-nodes-connectable", "false")
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-elements-selectable", "false")
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-nodes-focusable", "false")
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-edges-focusable", "false")
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-delete-key-code", "null")
    expect(screen.getByText("Yes")).toBeInTheDocument()
    expect(screen.getByText("No")).toBeInTheDocument()
  })

  it("shows a controlled error for an unsupported runtime node type", () => {
    const workflow = sampleWorkflow()
    workflow.nodes[0].type = "unknown" as Workflow["nodes"][number]["type"]
    render(<WorkflowCanvas workflow={workflow} />)
    expect(screen.getByRole("alert")).toHaveTextContent("unsupported node type")
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument()
  })
})
