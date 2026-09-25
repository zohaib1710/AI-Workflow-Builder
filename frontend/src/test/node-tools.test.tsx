import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import EditorShell from "../components/editor/EditorShell"
import EditorToolbar from "../components/editor/EditorToolbar"
import InspectorPanel from "../components/editor/InspectorPanel"
import ValidationIndicator from "../components/editor/ValidationIndicator"
import WorkflowEditorCanvas from "../components/editor/WorkflowEditorCanvas"
import type { FlowchartFlowNode } from "../components/editor/nodes/FlowchartNode"
import { EditorProvider, useEditorDispatch, useEditorState } from "../editor/EditorContext"
import { NODE_CREATION_PRESETS } from "../editor/types"
import type { Workflow } from "../types/workflow"

const flowCapture = vi.hoisted(() => ({ props: null as unknown }))
const screenToFlowPosition = vi.hoisted(() => vi.fn((point: { x: number; y: number }) => ({ x: point.x - 100, y: point.y - 50 })))
const setFlowNodes = vi.hoisted(() => vi.fn())

interface CapturedFlowProps {
  defaultNodes: FlowchartFlowNode[]
  panOnDrag: boolean
  zoomOnScroll: boolean
  onInit: (instance: { screenToFlowPosition: typeof screenToFlowPosition; setNodes: typeof setFlowNodes }) => void
  onNodeClick: (event: unknown, node: FlowchartFlowNode) => void
  onPaneClick: (event: { clientX: number; clientY: number }) => void
  children?: ReactNode
}

vi.mock("@xyflow/react", async () => {
  const React = await import("react")
  const flowInstance = { screenToFlowPosition, setNodes: setFlowNodes }
  return {
    Handle: ({ type, position }: { type: string; position: string }) => <span data-testid={`${type}-${position}`} />,
    Position: { Left: "left", Right: "right" },
    ReactFlow: (props: CapturedFlowProps) => {
      flowCapture.props = props
      React.useEffect(() => props.onInit(flowInstance), [props.onInit])
      return (
        <div data-testid="react-flow">
          {props.defaultNodes.map((node) => <button type="button" key={node.id} aria-label={`Select ${node.id}`} onClick={() => props.onNodeClick({}, node)}>{node.data.title}</button>)}
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
  screenToFlowPosition.mockClear()
  setFlowNodes.mockClear()
  vi.restoreAllMocks()
})

function workflowFixture(nodes: Workflow["nodes"] = [
  { id: "start", type: "start", title: "Receive", description: "Receive request.", application: null },
  { id: "review", type: "action", title: "Review", description: "Review request.", application: "CRM" },
  { id: "end", type: "end", title: "Finish", description: "Finish request.", application: null },
]): Workflow {
  const nodeIds = new Set(nodes.map((node) => node.id))
  return {
    title: "Review workflow",
    description: "Reviews a request.",
    nodes,
    edges: [
      { id: "edge-1", source: "start", target: "review", label: null },
      { id: "edge-2", source: "review", target: "end", label: null },
    ].filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
  }
}

function StateProbe() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  if (!state) return <output data-testid="editor-state">empty</output>
  return (
    <div>
      <output data-testid="editor-state">{JSON.stringify({
        nodes: state.present.workflow.nodes,
        edges: state.present.workflow.edges,
        presentationIds: Object.keys(state.present.nodePresentations),
        presentations: state.present.nodePresentations,
        selection: state.selection,
        activeTool: state.activeTool,
        pendingNodePreset: state.pendingNodePreset,
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
      <EditorToolbar editingViewport={editingViewport} />
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
    nodes: Array<Record<string, unknown> & { id: string; type: string; title: string; description: string; application: string | null }>
    edges: Array<{ id: string; source: string; target: string }>
    presentationIds: string[]
    presentations: Record<string, { nodeId: string; shape: string; position: { x: number; y: number } }>
    selection: { kind: string; nodeId?: string }
    activeTool: string
    pendingNodePreset: string | null
    history: number
    issues: string[]
  }
}

async function choosePreset(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add shape" }))
  fireEvent.click(screen.getByRole("menuitem", { name: label }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Add shape" })).toHaveAttribute("aria-pressed", "true"))
}

describe("node tools", () => {
  it.each([
    ["start", "start", "terminator"],
    ["end", "end", "terminator"],
    ["trigger", "trigger", "terminator"],
    ["process", "action", "process"],
    ["decision", "decision", "decision"],
    ["approval", "approval", "decision"],
    ["input-output", "api", "input-output"],
    ["database", "database", "database"],
    ["document", "notification", "document"],
    ["delay", "wait", "delay"],
    ["predefined-process", "action", "predefined-process"],
    ["manual-operation", "action", "manual-operation"],
  ])("maps preset %s to semantic %s and shape %s", (id, semanticType, shape) => {
    expect(NODE_CREATION_PRESETS.find((preset) => preset.id === id)).toMatchObject({ semanticType, shape })
  })

  it("creates one disconnected node at converted canvas coordinates", async () => {
    renderTools()
    await choosePreset("Process")

    act(() => flowProps().onPaneClick({ clientX: 310, clientY: 260 }))

    const state = stateValue()
    const created = state.nodes.at(-1)!
    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 310, y: 260 })
    expect(created.id).toMatch(/^node-/)
    expect(created.id).not.toBe("start")
    expect(created).toMatchObject({ type: "action", title: "New step", description: "Describe this step.", application: null })
    expect(created).not.toHaveProperty("position")
    expect(created).not.toHaveProperty("shape")
    expect(state.presentations[created.id]).toEqual({ nodeId: created.id, shape: "process", position: { x: 210, y: 242 } })
    expect(state.history).toBe(1)
    expect(state.selection).toEqual({ kind: "node", nodeId: created.id })
    expect(state.activeTool).toBe("select")
    expect(state.pendingNodePreset).toBeNull()
    expect(state.issues).toContain("disconnected_graph")
    expect(screen.getByText("1 workflow issue")).toBeInTheDocument()
    expect(document.querySelector('[data-ai-iteration-enabled="false"]')).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete node" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Add shape" })).toBeEnabled()
  })

  it("deletes a node with incident edges and presentation in one transaction", () => {
    renderTools()
    fireEvent.click(screen.getByRole("button", { name: "Select review" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete node" }))

    const state = stateValue()
    expect(state.nodes.map((node) => node.id)).toEqual(["start", "end"])
    expect(state.edges).toEqual([])
    expect(state.presentationIds).toEqual(["start", "end"])
    expect(state.selection).toEqual({ kind: "none" })
    expect(state.history).toBe(1)
    expect(state.edges.every((edge) => edge.source !== "review" && edge.target !== "review")).toBe(true)
    expect(screen.queryByRole("complementary", { name: "Node inspector" })).not.toBeInTheDocument()
  })

  it("deletes the final node without ending the editor session", () => {
    renderTools(workflowFixture([
      { id: "only", type: "action", title: "Only", description: "Only node.", application: null },
    ]))
    fireEvent.click(screen.getByRole("button", { name: "Select only" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete node" }))

    const state = stateValue()
    expect(state.nodes).toEqual([])
    expect(state.edges).toEqual([])
    expect(state.presentationIds).toEqual([])
    expect(state.selection).toEqual({ kind: "none" })
    expect(state.history).toBe(1)
    expect(screen.getByTestId("react-flow")).toBeInTheDocument()
    expect(screen.getByText("Workflow draft is empty")).toHaveAttribute("data-ai-iteration-enabled", "false")
  })

  it("exposes pressed states and enforces viewport and async toolbar locks", async () => {
    const { unmount } = renderTools()
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Add shape" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByRole("button", { name: "Connect" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Focus AI prompt" })).not.toBeInTheDocument()
    await choosePreset("Decision")
    expect(screen.getByRole("button", { name: "Add shape" })).toHaveAttribute("aria-pressed", "true")
    unmount()

    const { unmount: unmountNarrow } = renderTools(workflowFixture(), false)
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add shape" })).toBeDisabled()
    unmountNarrow()

    renderTools()
    fireEvent.click(screen.getByRole("button", { name: "Add shape" }))
    fireEvent.click(screen.getByRole("button", { name: "Set loading" }))
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add shape" })).toBeDisabled()
    expect(screen.getByRole("menuitem", { name: "Process" })).toBeDisabled()
    expect(flowProps().panOnDrag).toBe(true)
    expect(flowProps().zoomOnScroll).toBe(true)
  })

  it("requires confirmation before explicit reset and then clears the session", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(
      <EditorProvider workflow={workflowFixture()}>
        <EditorShell />
        <StateProbe />
      </EditorProvider>,
    )

    const newWorkflowButton = screen.getAllByRole("button", { name: "New workflow" }).at(-1)!
    fireEvent.click(newWorkflowButton)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("editor-state")).not.toHaveTextContent("empty")

    fireEvent.click(newWorkflowButton)
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId("editor-state")).toHaveTextContent("empty")
    expect(screen.getByLabelText("Empty workflow canvas")).toBeInTheDocument()
  })
})
