import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import InspectorPanel from "../components/editor/InspectorPanel"
import WorkflowEditorCanvas from "../components/editor/WorkflowEditorCanvas"
import type { FlowchartFlowNode } from "../components/editor/nodes/FlowchartNode"
import { EditorProvider, useEditorDispatch, useEditorState } from "../editor/EditorContext"
import type { Workflow } from "../types/workflow"

const flowCapture = vi.hoisted(() => ({ props: null as unknown }))
const setFlowNodes = vi.hoisted(() => vi.fn())
const fitFlowView = vi.hoisted(() => vi.fn())
const getFlowNodes = vi.hoisted(() => vi.fn())
const initialFitView = vi.hoisted(() => vi.fn())
const setFlowCenter = vi.hoisted(() => vi.fn())
const setFlowViewport = vi.hoisted(() => vi.fn())
const nodesInitialized = vi.hoisted(() => ({ current: true }))

interface CapturedFlowProps {
  defaultNodes: FlowchartFlowNode[]
  nodesDraggable: boolean
  elementsSelectable: boolean
  panOnDrag: boolean
  zoomOnScroll: boolean
  minZoom: number
  deleteKeyCode: null
  multiSelectionKeyCode: null
  onInit: (instance: { setNodes: typeof setFlowNodes; fitView: typeof fitFlowView; getNodes: typeof getFlowNodes; setCenter: typeof setFlowCenter; setViewport: typeof setFlowViewport }) => void
  onNodeClick: (event: unknown, node: FlowchartFlowNode) => void
  onPaneClick: () => void
  onNodeDragStop: (event: unknown, node: FlowchartFlowNode) => void
  children?: ReactNode
}

vi.mock("@xyflow/react", async () => {
  const React = await import("react")
  return {
  Handle: ({ type, position }: { type: string; position: string }) => <span data-testid={`${type}-${position}`} />,
  Position: { Left: "left", Right: "right" },
  ReactFlow: (props: CapturedFlowProps) => {
    flowCapture.props = props
    React.useEffect(() => props.onInit({
      setNodes: setFlowNodes,
      fitView: fitFlowView,
      getNodes: getFlowNodes,
      setCenter: setFlowCenter,
      setViewport: setFlowViewport,
    }), [props.onInit])
    return (
      <div data-testid="react-flow">
        {props.defaultNodes.map((node) => <button type="button" key={node.id} aria-label={`Select ${node.id}`} onClick={() => props.onNodeClick({}, node)}>{node.data.title}</button>)}
        <button type="button" aria-label="Canvas pane" onClick={props.onPaneClick}>Canvas</button>
        {props.children}
      </div>
    )
  },
  Background: () => <span data-testid="background" />,
  Controls: () => <span data-testid="controls" />,
  MiniMap: () => <span data-testid="minimap" />,
  useNodesInitialized: () => nodesInitialized.current,
  useReactFlow: () => ({ fitView: initialFitView }),
  }
})

afterEach(() => {
  cleanup()
  flowCapture.props = null
  setFlowNodes.mockClear()
  fitFlowView.mockReset()
  getFlowNodes.mockReset()
  initialFitView.mockReset()
  setFlowCenter.mockReset()
  setFlowViewport.mockReset()
  nodesInitialized.current = true
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null })
})

function workflowFixture(): Workflow {
  return {
    title: "Review workflow",
    description: "Reviews a request.",
    nodes: [
      { id: "start", type: "start", title: "Receive", description: "Receive request.", application: null },
      { id: "review", type: "action", title: "Review", description: "Review request.", application: "CRM" },
      { id: "end", type: "end", title: "Finish", description: "Finish request.", application: null },
    ],
    edges: [
      { id: "edge-1", source: "start", target: "review", label: null },
      { id: "edge-2", source: "review", target: "end", label: null },
    ],
  }
}

function StateProbe() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  if (!state) return null
  const node = state.present.workflow.nodes.find((candidate) => candidate.id === "review")!
  const presentation = state.present.nodePresentations.review
  return (
    <div>
      <output data-testid="selection">{state.selection.kind === "node" ? state.selection.nodeId : state.selection.kind}</output>
      <output data-testid="history-count">{state.past.length}</output>
      <output data-testid="node-state">{JSON.stringify({ node, presentation })}</output>
      <button type="button" onClick={() => dispatch({ type: "async/set", asyncState: { status: "loading" } })}>Set loading</button>
      <button type="button" onClick={() => dispatch({ type: "tool/set", tool: "shape" })}>Use shape</button>
      <button type="button" onClick={() => dispatch({ type: "history/undo" })}>Undo test change</button>
      <button type="button" onClick={() => dispatch({ type: "history/redo" })}>Redo test change</button>
    </div>
  )
}

function renderEditor(editingViewport = true) {
  return render(
    <EditorProvider workflow={workflowFixture()}>
      <WorkflowEditorCanvas editingViewport={editingViewport} />
      <InspectorPanel editingViewport={editingViewport} />
      <StateProbe />
    </EditorProvider>,
  )
}

function flowProps(): CapturedFlowProps {
  return flowCapture.props as CapturedFlowProps
}

function selectReview() {
  fireEvent.click(screen.getByRole("button", { name: "Select review" }))
}

function currentNodeState() {
  return JSON.parse(screen.getByTestId("node-state").textContent ?? "{}") as {
    node: { type: string; title: string; description: string; application: string | null; position?: unknown }
    presentation: { shape: string; color?: string; position: { x: number; y: number } }
  }
}

describe("node editing", () => {
  it("fits all workflow nodes after entering fullscreen and allows deep zoom", () => {
    const requestFrame = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 1
    })
    renderEditor()
    getFlowNodes.mockReturnValue([
      ...flowProps().defaultNodes,
      { id: "note", type: "annotation", hidden: false },
    ])

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.documentElement,
    })
    act(() => document.dispatchEvent(new Event("fullscreenchange")))

    expect(flowProps().minZoom).toBe(0.05)
    expect(requestFrame).toHaveBeenCalledTimes(2)
    expect(fitFlowView).toHaveBeenCalledTimes(1)
    expect(fitFlowView).toHaveBeenCalledWith(expect.objectContaining({
      padding: 0.08,
      minZoom: 0.05,
      maxZoom: 1,
      nodes: expect.arrayContaining(flowProps().defaultNodes),
    }))
    expect(fitFlowView.mock.calls[0][0].nodes).toHaveLength(flowProps().defaultNodes.length)

    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null })
    act(() => document.dispatchEvent(new Event("fullscreenchange")))
    expect(fitFlowView).toHaveBeenCalledTimes(1)
    requestFrame.mockRestore()
  })

  it("selects one node and clears transient selection from the canvas", () => {
    renderEditor()
    selectReview()
    expect(screen.getByTestId("selection")).toHaveTextContent("review")
    expect(screen.getByRole("complementary", { name: "Node inspector" })).toBeInTheDocument()
    expect(screen.getByTestId("history-count")).toHaveTextContent("0")

    fireEvent.click(screen.getByRole("button", { name: "Canvas pane" }))
    expect(screen.getByTestId("selection")).toHaveTextContent("none")
    expect(screen.queryByRole("complementary", { name: "Node inspector" })).not.toBeInTheDocument()
    expect(screen.getByTestId("history-count")).toHaveTextContent("0")
  })

  it("keeps drag preview local and commits one presentation-only transaction", () => {
    renderEditor()
    setFlowNodes.mockClear()
    initialFitView.mockClear()
    fitFlowView.mockClear()
    const before = currentNodeState()
    const dragged = { ...flowProps().defaultNodes.find((node) => node.id === "review")!, position: { x: 420, y: 215 } }

    expect(flowProps()).not.toHaveProperty("nodes")
    expect(currentNodeState()).toEqual(before)
    expect(setFlowNodes).not.toHaveBeenCalled()
    expect(screen.getByTestId("history-count")).toHaveTextContent("0")

    nodesInitialized.current = false
    act(() => flowProps().onNodeDragStop({}, dragged))
    expect(currentNodeState().presentation.position).toEqual({ x: 420, y: 215 })
    expect(currentNodeState().node).toEqual(before.node)
    expect(currentNodeState().node).not.toHaveProperty("position")
    expect(screen.getByTestId("history-count")).toHaveTextContent("1")
    expect(setFlowNodes).toHaveBeenCalledTimes(1)
    expect(setFlowNodes.mock.calls[0][0].find((node: FlowchartFlowNode) => node.id === "review")?.position).toEqual({ x: 420, y: 215 })

    nodesInitialized.current = true
    selectReview()
    expect(initialFitView).not.toHaveBeenCalled()
    expect(fitFlowView).not.toHaveBeenCalled()
    expect(setFlowCenter).not.toHaveBeenCalled()
    expect(setFlowViewport).not.toHaveBeenCalled()

    act(() => flowProps().onNodeDragStop({}, dragged))
    expect(screen.getByTestId("history-count")).toHaveTextContent("1")
  })

  it("preserves a manual position while committing trimmed semantic fields separately", () => {
    renderEditor()
    const dragged = { ...flowProps().defaultNodes.find((node) => node.id === "review")!, position: { x: 420, y: 90 } }
    act(() => flowProps().onNodeDragStop({}, dragged))
    selectReview()

    const title = screen.getByRole("textbox", { name: "Title" })
    fireEvent.change(title, { target: { value: "  Updated review  " } })
    fireEvent.blur(title)
    const description = screen.getByRole("textbox", { name: "Description" })
    fireEvent.change(description, { target: { value: "  Updated description.  " } })
    fireEvent.blur(description)
    const application = screen.getByRole("textbox", { name: "Application" })
    fireEvent.change(application, { target: { value: "   " } })
    fireEvent.blur(application)

    const current = currentNodeState()
    expect(current.node).toMatchObject({ title: "Updated review", description: "Updated description.", application: null })
    expect(current.presentation.position).toEqual({ x: 420, y: 90 })
    expect(screen.getByTestId("history-count")).toHaveTextContent("4")
  })

  it("changes visual shape without changing semantic type or position", () => {
    renderEditor()
    selectReview()
    const before = currentNodeState()
    fireEvent.change(screen.getByRole("combobox", { name: "Shape" }), { target: { value: "decision" } })
    const current = currentNodeState()
    expect(current.presentation.shape).toBe("decision")
    expect(current.presentation.position).toEqual(before.presentation.position)
    expect(current.node.type).toBe("action")
    expect(screen.getByRole("textbox", { name: "Semantic type" })).toHaveValue("action")
    expect(screen.getByRole("textbox", { name: "Semantic type" })).toHaveAttribute("readonly")
    expect(screen.getByRole("button", { name: "Delete node" })).toBeEnabled()
    expect(screen.getByTestId("history-count")).toHaveTextContent("1")
  })

  it("changes presentation color without changing semantic data and records one transaction", () => {
    renderEditor()
    selectReview()
    const before = currentNodeState()
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#db2777" } })
    const current = currentNodeState()
    expect(current.presentation.color).toBe("#db2777")
    expect(current.presentation.position).toEqual(before.presentation.position)
    expect(current.node).toEqual(before.node)
    expect(screen.getByTestId("history-count")).toHaveTextContent("1")
    fireEvent.click(screen.getByRole("button", { name: "Undo test change" }))
    expect(currentNodeState().presentation.color).toBeUndefined()
    fireEvent.click(screen.getByRole("button", { name: "Redo test change" }))
    expect(currentNodeState().presentation.color).toBe("#db2777")
  })

  it.each([
    ["Title", "Title is required."],
    ["Description", "Description is required."],
  ])("rejects a blank %s without recording history", (field, message) => {
    renderEditor()
    selectReview()
    const input = screen.getByRole("textbox", { name: field })
    fireEvent.change(input, { target: { value: "   " } })
    fireEvent.blur(input)
    expect(screen.getByRole("alert")).toHaveTextContent(message)
    expect(screen.getByTestId("history-count")).toHaveTextContent("0")
  })

  it("disables runtime editing outside the supported viewport and tool", () => {
    const { unmount } = renderEditor(false)
    expect(flowProps().nodesDraggable).toBe(false)
    expect(flowProps().elementsSelectable).toBe(false)
    expect(screen.queryByRole("complementary", { name: "Node inspector" })).not.toBeInTheDocument()
    unmount()

    renderEditor(true)
    selectReview()
    fireEvent.click(screen.getByRole("button", { name: "Use shape" }))
    expect(flowProps().nodesDraggable).toBe(false)
    expect(flowProps().elementsSelectable).toBe(false)
    expect(flowProps().panOnDrag).toBe(true)
    expect(flowProps().zoomOnScroll).toBe(true)
    expect(screen.getByRole("textbox", { name: "Title" })).toBeDisabled()
  })

  it("locks dragging and inspector mutation during async work", () => {
    renderEditor()
    selectReview()
    const before = currentNodeState()
    fireEvent.click(screen.getByRole("button", { name: "Set loading" }))
    expect(flowProps().nodesDraggable).toBe(false)
    expect(screen.getByRole("textbox", { name: "Title" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Shape" })).toBeDisabled()
    expect(flowProps().panOnDrag).toBe(true)
    expect(flowProps().zoomOnScroll).toBe(true)

    const blockedDrag = { ...flowProps().defaultNodes.find((node) => node.id === "review")!, position: { x: 999, y: 999 } }
    act(() => flowProps().onNodeDragStop({}, blockedDrag))
    expect(currentNodeState()).toEqual(before)
    expect(screen.getByTestId("history-count")).toHaveTextContent("0")
  })
})
