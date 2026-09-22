import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import EditorShell from "../components/editor/EditorShell"
import EditorToolbar from "../components/editor/EditorToolbar"
import InspectorPanel from "../components/editor/InspectorPanel"
import WorkflowEditorCanvas from "../components/editor/WorkflowEditorCanvas"
import { EditorProvider, useEditorDispatch, useEditorState } from "../editor/EditorContext"
import type { Workflow } from "../types/workflow"

const flowCapture = vi.hoisted(() => ({ props: null as unknown }))
const screenToFlowPosition = vi.hoisted(() => vi.fn((point: { x: number; y: number }) => ({ x: point.x - 100, y: point.y - 50 })))
const setFlowNodes = vi.hoisted(() => vi.fn())

interface EditorViewNode {
  id: string
  type: "flowchart" | "annotation"
  position: { x: number; y: number }
  data: Record<string, unknown>
  connectable: boolean
}

interface CapturedFlowProps {
  defaultNodes: EditorViewNode[]
  panOnDrag: boolean
  zoomOnScroll: boolean
  onInit: (instance: { screenToFlowPosition: typeof screenToFlowPosition; setNodes: typeof setFlowNodes }) => void
  onNodeClick: (event: unknown, node: EditorViewNode) => void
  onEdgeClick: (event: unknown, edge: { id: string }) => void
  onPaneClick: (event: { clientX: number; clientY: number }) => void
  onNodeDragStop: (event: unknown, node: EditorViewNode) => void
  edges: Array<{ id: string; label: string | null }>
  children?: ReactNode
}

vi.mock("@xyflow/react", async () => {
  const React = await import("react")
  const instance = { screenToFlowPosition, setNodes: setFlowNodes }
  return {
    Handle: ({ type, position }: { type: string; position: string }) => <span data-testid={`${type}-${position}`} />,
    Position: { Left: "left", Right: "right" },
    ReactFlow: (props: CapturedFlowProps) => {
      flowCapture.props = props
      React.useEffect(() => props.onInit(instance), [props.onInit])
      return (
        <div data-testid="react-flow">
          {props.defaultNodes.map((node) => (
            <button
              type="button"
              key={node.id}
              aria-label={node.type === "annotation" ? `Select annotation ${node.id}` : `Select node ${node.id}`}
              onClick={() => props.onNodeClick({}, node)}
            >
              {String(node.data.text ?? node.data.title)}
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
  screenToFlowPosition.mockClear()
  setFlowNodes.mockClear()
  vi.restoreAllMocks()
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

function StateProbe() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  if (!state) return <output data-testid="editor-state">empty</output>
  return (
    <div>
      <output data-testid="editor-state">{JSON.stringify({
        workflow: state.present.workflow,
        annotations: state.present.annotations,
        selection: state.selection,
        activeTool: state.activeTool,
        history: state.past.length,
        future: state.future.length,
      })}</output>
      <button type="button" onClick={() => dispatch({ type: "async/set", asyncState: { status: "loading" } })}>Set loading</button>
    </div>
  )
}

function renderTools(editingViewport = true) {
  return render(
    <EditorProvider workflow={workflowFixture()}>
      <WorkflowEditorCanvas editingViewport={editingViewport} />
      <EditorToolbar editingViewport={editingViewport} onNewWorkflow={() => undefined} />
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
    workflow: Workflow
    annotations: Array<{ id: string; text: string; position: { x: number; y: number } }>
    selection: { kind: string; nodeId?: string; edgeId?: string; annotationId?: string }
    activeTool: string
    history: number
    future: number
  }
}

function createAnnotation(clientX = 310, clientY = 260) {
  fireEvent.click(screen.getByRole("button", { name: "Add text" }))
  act(() => flowProps().onPaneClick({ clientX, clientY }))
}

describe("annotations and editor shortcuts", () => {
  it("creates one presentation-only annotation at converted canvas coordinates", () => {
    const originalWorkflow = workflowFixture()
    renderTools()
    fireEvent.click(screen.getByRole("button", { name: "Add text" }))
    expect(screen.getByRole("button", { name: "Add text" })).toHaveAttribute("aria-pressed", "true")
    act(() => flowProps().onPaneClick({ clientX: 310, clientY: 260 }))

    const state = stateValue()
    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 310, y: 260 })
    expect(state.annotations).toHaveLength(1)
    expect(state.annotations[0]).toMatchObject({ text: "Text", position: { x: 210, y: 210 } })
    expect(state.selection).toEqual({ kind: "annotation", annotationId: state.annotations[0].id })
    expect(state.activeTool).toBe("select")
    expect(state.history).toBe(1)
    expect(state.workflow).toEqual(originalWorkflow)
    expect(state.workflow).not.toHaveProperty("annotations")
    expect(flowProps().defaultNodes.find((node) => node.id === state.annotations[0].id)).toMatchObject({
      type: "annotation",
      connectable: false,
    })
  })

  it("retries a colliding annotation ID", () => {
    const uuid = vi.spyOn(globalThis.crypto, "randomUUID")
    uuid.mockReturnValueOnce("collision" as ReturnType<Crypto["randomUUID"]>)
    uuid.mockReturnValueOnce("collision" as ReturnType<Crypto["randomUUID"]>)
    uuid.mockReturnValueOnce("unique" as ReturnType<Crypto["randomUUID"]>)
    renderTools()
    createAnnotation()
    createAnnotation(410, 360)

    expect(stateValue().annotations.map((annotation) => annotation.id)).toEqual([
      "annotation-collision",
      "annotation-unique",
    ])
    expect(uuid).toHaveBeenCalledTimes(3)
  })

  it("edits, previews movement, commits movement, and deletes without semantic changes", () => {
    const workflow = workflowFixture()
    renderTools()
    createAnnotation()
    const annotationId = stateValue().annotations[0].id
    const text = screen.getByRole("textbox", { name: "Text" })
    fireEvent.change(text, { target: { value: "  <script>alert('x')</script>  " } })
    fireEvent.blur(text)
    expect(stateValue().annotations[0].text).toBe("<script>alert('x')</script>")
    expect(stateValue().history).toBe(2)

    const annotationNode = flowProps().defaultNodes.find((node) => node.id === annotationId)!
    const moved = { ...annotationNode, position: { x: 500, y: 420 } }
    expect(flowProps()).not.toHaveProperty("nodes")
    expect(stateValue().history).toBe(2)
    act(() => flowProps().onNodeDragStop({}, moved))
    expect(stateValue().annotations[0].position).toEqual({ x: 500, y: 420 })
    expect(stateValue().history).toBe(3)

    fireEvent.click(screen.getByRole("button", { name: "Delete annotation" }))
    expect(stateValue().annotations).toEqual([])
    expect(stateValue().selection).toEqual({ kind: "none" })
    expect(stateValue().history).toBe(4)
    expect(stateValue().workflow).toEqual(workflow)
  })

  it("uses Escape to clear selection and return to Select without history", () => {
    renderTools()
    fireEvent.click(screen.getByRole("button", { name: "Select node review" }))
    fireEvent.click(screen.getByRole("button", { name: "Add text" }))
    expect(stateValue().selection).toEqual({ kind: "node", nodeId: "review" })
    expect(stateValue().activeTool).toBe("text")

    fireEvent.keyDown(window, { key: "Escape" })
    expect(stateValue().selection).toEqual({ kind: "none" })
    expect(stateValue().activeTool).toBe("select")
    expect(stateValue().history).toBe(0)
  })

  it("does not intercept deletion or history shortcuts while typing", () => {
    renderTools()
    fireEvent.click(screen.getByRole("button", { name: "Select node review" }))
    const description = screen.getByRole("textbox", { name: "Description" })
    fireEvent.change(description, { target: { value: "Changed description" } })
    fireEvent.blur(description)
    expect(stateValue().history).toBe(1)

    description.focus()
    fireEvent.keyDown(description, { key: "Delete" })
    fireEvent.keyDown(description, { key: "Backspace" })
    fireEvent.keyDown(description, { key: "z", ctrlKey: true })
    expect(stateValue().workflow.nodes.some((node) => node.id === "review")).toBe(true)
    expect(stateValue().workflow.nodes.find((node) => node.id === "review")?.description).toBe("Changed description")
    expect(stateValue().history).toBe(1)
  })

  it.each([
    ["node", "Delete"],
    ["edge", "Backspace"],
    ["annotation", "Delete"],
  ] as const)("deletes the selected %s through the guarded keyboard transaction", (target, key) => {
    renderTools()
    if (target === "node") {
      fireEvent.click(screen.getByRole("button", { name: "Select node review" }))
    } else if (target === "edge") {
      fireEvent.click(screen.getByRole("button", { name: "Select connection edge-1" }))
    } else {
      createAnnotation()
    }

    fireEvent.keyDown(window, { key })
    if (target === "node") {
      expect(stateValue().workflow.nodes.some((node) => node.id === "review")).toBe(false)
      expect(stateValue().history).toBe(1)
    } else if (target === "edge") {
      expect(stateValue().workflow.edges.some((edge) => edge.id === "edge-1")).toBe(false)
      expect(stateValue().history).toBe(1)
    } else {
      expect(stateValue().annotations).toEqual([])
      expect(stateValue().history).toBe(2)
    }
    expect(stateValue().selection).toEqual({ kind: "none" })
  })

  it("uses existing history for Ctrl/Cmd undo and redo variants", () => {
    renderTools()
    createAnnotation()
    expect(stateValue().annotations).toHaveLength(1)

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    expect(stateValue().annotations).toEqual([])
    expect(stateValue().selection).toEqual({ kind: "none" })
    expect(stateValue().activeTool).toBe("select")
    fireEvent.keyDown(window, { key: "Z", metaKey: true, shiftKey: true })
    expect(stateValue().annotations).toHaveLength(1)

    fireEvent.keyDown(window, { key: "z", metaKey: true })
    expect(stateValue().annotations).toEqual([])
    fireEvent.keyDown(window, { key: "y", ctrlKey: true })
    expect(stateValue().annotations).toHaveLength(1)
  })

  it("keeps the bounded toolbar accessible, focuses either composer, and respects locks", async () => {
    const withWorkflow = render(
      <EditorProvider workflow={workflowFixture()}>
        <EditorShell />
      </EditorProvider>,
    )
    for (const label of ["Select", "Add shape", "Connect", "Add text", "Focus AI prompt"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Add text" }))
    expect(screen.getByRole("button", { name: "Add text" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Focus AI prompt" }))
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveFocus()
    withWorkflow.unmount()

    const empty = render(
      <EditorProvider>
        <EditorShell />
      </EditorProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Focus AI prompt" }))
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveFocus()
    empty.unmount()

    const narrow = renderTools(false)
    expect(screen.getByRole("button", { name: "Add text" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Focus AI prompt" })).toBeEnabled()
    narrow.unmount()

    renderTools()
    fireEvent.click(screen.getByRole("button", { name: "Set loading" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Add text" })).toBeDisabled())
  })
})
