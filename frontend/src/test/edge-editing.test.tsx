import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import EditorToolbar from "../components/editor/EditorToolbar"
import InspectorPanel from "../components/editor/InspectorPanel"
import ValidationIndicator from "../components/editor/ValidationIndicator"
import WorkflowEditorCanvas from "../components/editor/WorkflowEditorCanvas"
import type { FlowchartFlowNode } from "../components/editor/nodes/FlowchartNode"
import { EditorProvider, useEditorDispatch, useEditorState } from "../editor/EditorContext"
import type { Workflow } from "../types/workflow"

const flowCapture = vi.hoisted(() => ({ props: null as unknown }))
const setFlowNodes = vi.hoisted(() => vi.fn())

interface ConnectionRequest {
  source: string | null
  target: string | null
  sourceHandle: string | null
  targetHandle: string | null
}

interface CapturedFlowProps {
  defaultNodes: FlowchartFlowNode[]
  edges: Array<{ id: string; source: string; target: string; label: string | null }>
  nodesConnectable: boolean
  panOnDrag: boolean
  zoomOnScroll: boolean
  onInit: (instance: { screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number }; setNodes: typeof setFlowNodes }) => void
  onConnect: (connection: ConnectionRequest) => void
  onNodeClick: (event: unknown, node: FlowchartFlowNode) => void
  onEdgeClick: (event: unknown, edge: CapturedFlowProps["edges"][number]) => void
  children?: ReactNode
}

vi.mock("@xyflow/react", async () => {
  const React = await import("react")
  const instance = { screenToFlowPosition: (point: { x: number; y: number }) => point, setNodes: setFlowNodes }
  return {
    Handle: ({ type, position }: { type: string; position: string }) => <span data-testid={`${type}-${position}`} />,
    Position: { Left: "left", Right: "right" },
    ReactFlow: (props: CapturedFlowProps) => {
      flowCapture.props = props
      React.useEffect(() => props.onInit(instance), [props.onInit])
      return (
        <div data-testid="react-flow">
          {props.defaultNodes.map((node) => (
            <button type="button" key={node.id} aria-label={`Select node ${node.id}`} onClick={() => props.onNodeClick({}, node)}>
              {node.data.title}
            </button>
          ))}
          {props.edges.map((edge) => (
            <button type="button" key={edge.id} aria-label={`Select connection ${edge.id}`} onClick={() => props.onEdgeClick({}, edge)}>
              {edge.label ?? edge.id}
            </button>
          ))}
          {props.children}
        </div>
      )
    },
    Background: () => <span data-testid="background" />,
    Controls: () => <span data-testid="controls" />,
    MiniMap: () => <span data-testid="minimap" />,
    useNodesInitialized: () => true,
    useReactFlow: () => ({ fitView: vi.fn() }),
  }
})

afterEach(() => {
  cleanup()
  flowCapture.props = null
  setFlowNodes.mockClear()
  vi.restoreAllMocks()
})

function workflowFixture(extraEdgeId?: string): Workflow {
  return {
    title: "Approval workflow",
    description: "Reviews a request.",
    nodes: [
      { id: "start", type: "start", title: "Start", description: "Start.", application: null },
      { id: "review", type: "action", title: "Review", description: "Review.", application: null },
      { id: "decision", type: "decision", title: "Decide", description: "Decide.", application: null },
      { id: "approved", type: "end", title: "Approved", description: "Approve.", application: null },
      { id: "rejected", type: "end", title: "Rejected", description: "Reject.", application: null },
    ],
    edges: [
      { id: "edge-1", source: "start", target: "review", label: null },
      { id: "edge-2", source: "review", target: "decision", label: null },
      { id: "yes", source: "decision", target: "approved", label: "Yes" },
      { id: "no", source: "decision", target: "rejected", label: "No" },
      ...(extraEdgeId ? [{ id: extraEdgeId, source: "start", target: "review", label: null }] : []),
    ],
    assumptions: [],
    missingRequirements: [],
    suggestions: [],
  }
}

function StateProbe() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  if (!state) return null
  return (
    <div>
      <output data-testid="editor-state">{JSON.stringify({
        nodes: state.present.workflow.nodes,
        edges: state.present.workflow.edges,
        selection: state.selection,
        activeTool: state.activeTool,
        history: state.past.length,
        issues: state.issues.map((issue) => issue.code),
      })}</output>
      <button type="button" onClick={() => dispatch({ type: "async/set", asyncState: { status: "loading" } })}>Set loading</button>
    </div>
  )
}

function renderTools(workflow = workflowFixture(), editingViewport = true) {
  return render(
    <EditorProvider workflow={workflow}>
      <WorkflowEditorCanvas editingViewport={editingViewport} />
      <EditorToolbar editingViewport={editingViewport} onNewWorkflow={() => undefined} />
      <ValidationIndicator />
      <InspectorPanel editingViewport={editingViewport} />
      <StateProbe />
    </EditorProvider>,
  )
}

function flowProps(): CapturedFlowProps {
  return flowCapture.props as CapturedFlowProps
}

function stateValue() {
  return JSON.parse(screen.getByTestId("editor-state").textContent ?? "{}") as {
    nodes: Workflow["nodes"]
    edges: Workflow["edges"]
    selection: { kind: string; edgeId?: string; nodeId?: string }
    activeTool: string
    history: number
    issues: string[]
  }
}

function connection(source: string | null, target: string | null): ConnectionRequest {
  return { source, target, sourceHandle: null, targetHandle: null }
}

async function enableConnect() {
  fireEvent.click(screen.getByRole("button", { name: "Connect" }))
  await waitFor(() => expect(flowProps().nodesConnectable).toBe(true))
}

describe("edge editing", () => {
  it("gates connection commits behind Connect mode", async () => {
    renderTools()
    act(() => flowProps().onConnect(connection("review", "approved")))
    expect(stateValue().edges).toHaveLength(4)
    expect(stateValue().history).toBe(0)

    await enableConnect()
    expect(screen.getByRole("button", { name: "Connect" })).toHaveAttribute("aria-pressed", "true")
    act(() => flowProps().onConnect(connection("review", "approved")))
    expect(stateValue().edges).toHaveLength(5)
    expect(stateValue().history).toBe(1)
  })

  it("retries a colliding generated edge ID", async () => {
    const uuid = vi.spyOn(globalThis.crypto, "randomUUID")
    uuid.mockReturnValueOnce("collision" as ReturnType<Crypto["randomUUID"]>)
    uuid.mockReturnValueOnce("unique" as ReturnType<Crypto["randomUUID"]>)
    renderTools(workflowFixture("edge-collision"))
    await enableConnect()
    act(() => flowProps().onConnect(connection("review", "approved")))

    expect(stateValue().edges.at(-1)?.id).toBe("edge-unique")
    expect(uuid).toHaveBeenCalledTimes(2)
  })

  it("rejects self-connections and missing endpoints without history", async () => {
    renderTools()
    await enableConnect()
    act(() => flowProps().onConnect(connection("review", "review")))
    act(() => flowProps().onConnect(connection(null, "approved")))
    act(() => flowProps().onConnect(connection("missing", "approved")))
    act(() => flowProps().onConnect(connection("review", "missing")))

    expect(stateValue().edges).toHaveLength(4)
    expect(stateValue().history).toBe(0)
  })

  it("requires and safely cancels a decision branch label before committing", async () => {
    renderTools()
    await enableConnect()
    act(() => flowProps().onConnect(connection("decision", "review")))
    expect(screen.getByRole("dialog", { name: "Label decision branch" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add connection" })).toBeDisabled()

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Branch label" }), { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(stateValue().history).toBe(0)

    act(() => flowProps().onConnect(connection("decision", "review")))
    fireEvent.change(screen.getByRole("textbox", { name: "Branch label" }), { target: { value: "  Maybe  " } })
    fireEvent.click(screen.getByRole("button", { name: "Add connection" }))
    expect(stateValue().edges.at(-1)?.label).toBe("Maybe")
    expect(stateValue().history).toBe(1)
  })

  it("commits non-decision connections immediately with a null label", async () => {
    renderTools()
    await enableConnect()
    act(() => flowProps().onConnect(connection("review", "approved")))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(stateValue().edges.at(-1)).toMatchObject({ source: "review", target: "approved", label: null })
    expect(stateValue().history).toBe(1)
  })

  it("selects one edge and commits one trimmed label edit", () => {
    renderTools()
    fireEvent.click(screen.getByRole("button", { name: "Select connection edge-1" }))
    expect(screen.getByRole("complementary", { name: "Edge inspector" })).toBeInTheDocument()
    const label = screen.getByRole("textbox", { name: "Label" })
    fireEvent.change(label, { target: { value: "  Handoff  " } })
    fireEvent.blur(label)

    expect(stateValue().edges.find((edge) => edge.id === "edge-1")?.label).toBe("Handoff")
    expect(stateValue().history).toBe(1)
    expect(stateValue().selection).toEqual({ kind: "edge", edgeId: "edge-1" })
    fireEvent.blur(label)
    expect(stateValue().history).toBe(1)

    fireEvent.click(screen.getByRole("button", { name: "Select node review" }))
    expect(stateValue().selection).toEqual({ kind: "node", nodeId: "review" })
    expect(stateValue().history).toBe(1)
  })

  it("allows blanking an existing decision label and surfaces validation", () => {
    renderTools()
    fireEvent.click(screen.getByRole("button", { name: "Select connection yes" }))
    const label = screen.getByRole("textbox", { name: "Label" })
    fireEvent.change(label, { target: { value: "   " } })
    fireEvent.blur(label)

    expect(stateValue().edges.find((edge) => edge.id === "yes")?.label).toBeNull()
    expect(stateValue().issues).toContain("decision_edge_label_required")
    expect(stateValue().history).toBe(1)
    expect(screen.getByText(/workflow issue/)).toBeInTheDocument()
  })

  it("deletes one selected edge without removing nodes", () => {
    renderTools()
    const nodeIds = stateValue().nodes.map((node) => node.id)
    fireEvent.click(screen.getByRole("button", { name: "Select connection edge-1" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete connection" }))

    expect(stateValue().edges.some((edge) => edge.id === "edge-1")).toBe(false)
    expect(stateValue().nodes.map((node) => node.id)).toEqual(nodeIds)
    expect(stateValue().selection).toEqual({ kind: "none" })
    expect(stateValue().history).toBe(1)
    expect(stateValue().issues).toContain("disconnected_graph")
  })

  it("locks connection and inspector mutation on narrow or loading states", async () => {
    const { unmount } = renderTools(workflowFixture(), false)
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled()
    expect(flowProps().nodesConnectable).toBe(false)
    expect(flowProps().panOnDrag).toBe(true)
    expect(flowProps().zoomOnScroll).toBe(true)
    unmount()

    renderTools()
    fireEvent.click(screen.getByRole("button", { name: "Select connection edge-1" }))
    fireEvent.click(screen.getByRole("button", { name: "Set loading" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled())
    expect(screen.getByRole("textbox", { name: "Label" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Delete connection" })).toBeDisabled()
    expect(flowProps().nodesConnectable).toBe(false)
  })
})
