import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type { NodeProps } from "@xyflow/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import FlowchartNode, { type FlowchartFlowNode } from "../components/editor/nodes/FlowchartNode"
import { FLOWCHART_SHAPES, flowchartShapeNames } from "../components/editor/nodes/shapeRegistry"
import { DEFAULT_SHAPE_BY_NODE_TYPE, type FlowchartShape } from "../editor/types"
import type { SupportedNodeType } from "../types/workflow"

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, position, children, isConnectable, ...props }: {
    type: string
    position: string
    children?: ReactNode
    isConnectable?: boolean
    [key: string]: unknown
  }) => <span data-testid={`${type}-${position}`} data-connectable={String(isConnectable)} {...props}>{children}</span>,
  Position: { Left: "left", Right: "right" },
}))

afterEach(cleanup)

function nodeProps(nodeType: SupportedNodeType, shape: string): NodeProps<FlowchartFlowNode> {
  return {
    id: "node-1",
    type: "flowchart",
    data: {
      nodeType,
      shape,
      title: "Review request",
      description: "Check the submitted details.",
      application: "Operations",
      color: "#2563eb",
      hasIncomingConnection: false,
      hasOutgoingConnection: false,
    },
    dragging: false,
    draggable: false,
    deletable: false,
    zIndex: 0,
    isConnectable: false,
    selectable: false,
    selected: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  }
}

describe("flowchart shape renderer", () => {
  it("defines a stable default color for every shape", () => {
    for (const shape of flowchartShapeNames) {
      expect(FLOWCHART_SHAPES[shape].defaultColor).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it.each(flowchartShapeNames)("renders authored %s geometry", (shape) => {
    const { container } = render(<FlowchartNode {...nodeProps("action", shape)} />)
    expect(container.querySelector(`[data-shape-geometry="${shape}"]`)).toBeInTheDocument()
  })

  it.each([
    ["start", "terminator"], ["end", "terminator"], ["trigger", "terminator"],
    ["action", "process"], ["decision", "decision"], ["api", "process"],
    ["database", "database"], ["wait", "delay"], ["approval", "decision"],
    ["notification", "document"],
  ] satisfies [SupportedNodeType, FlowchartShape][])("maps %s to %s by default", (nodeType, shape) => {
    expect(DEFAULT_SHAPE_BY_NODE_TYPE[nodeType]).toBe(shape)
  })

  it("keeps semantic type independent from the visual shape", () => {
    const { container } = render(<FlowchartNode {...nodeProps("action", "decision")} />)
    expect(screen.getByText("Action")).toBeInTheDocument()
    expect(container.querySelector('[data-shape-geometry="decision"]')).toBeInTheDocument()
    expect(container.querySelector(".flowchart-node--action")).toBeInTheDocument()
  })

  it("renders workflow values as plain text", () => {
    const props = nodeProps("notification", "document")
    props.data = {
      ...props.data,
      title: "<script>alert('title')</script>",
      description: "<img src=x onerror=alert('description')>",
      application: "<svg onload=alert('application')>",
    }
    const { container } = render(<FlowchartNode {...props} />)
    expect(screen.getByText("<script>alert('title')</script>")).toBeInTheDocument()
    expect(screen.getByText("<img src=x onerror=alert('description')>")).toBeInTheDocument()
    expect(screen.getByText("<svg onload=alert('application')>")).toBeInTheDocument()
    expect(container.querySelector("script, img")).not.toBeInTheDocument()
  })

  it("uses semantic boundary rules and marks only missing legal sides", () => {
    const { rerender } = render(<FlowchartNode {...nodeProps("start", "decision")} />)
    expect(screen.queryByTestId("target-left")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Connect outgoing side")).toHaveClass("flowchart-node__handle--missing")

    rerender(<FlowchartNode {...nodeProps("end", "process")} />)
    expect(screen.getByLabelText("Connect incoming side")).toHaveClass("flowchart-node__handle--missing")
    expect(screen.queryByTestId("source-right")).not.toBeInTheDocument()

    rerender(<FlowchartNode {...nodeProps("action", "terminator")} />)
    expect(screen.getByLabelText("Connect incoming side")).toBeInTheDocument()
    expect(screen.getByLabelText("Connect outgoing side")).toBeInTheDocument()
  })

  it("keeps compact handles after each side is connected", () => {
    const props = nodeProps("action", "process")
    props.data = { ...props.data, hasIncomingConnection: true, hasOutgoingConnection: true }
    render(<FlowchartNode {...props} />)

    expect(screen.getByLabelText("Incoming connection")).not.toHaveClass("flowchart-node__handle--missing")
    expect(screen.getByLabelText("Outgoing connection")).not.toHaveClass("flowchart-node__handle--missing")
    expect(screen.queryByText("→")).not.toBeInTheDocument()
  })

  it("falls back deterministically for an unsupported runtime shape", () => {
    const { container } = render(<FlowchartNode {...nodeProps("action", "hexagon")} />)
    expect(container.querySelector('[data-shape-status="unsupported"]')).toBeInTheDocument()
    expect(container.querySelector('[data-shape-geometry="process"]')).toBeInTheDocument()
    expect(screen.getByText("Unsupported shape")).toBeInTheDocument()
  })
})
