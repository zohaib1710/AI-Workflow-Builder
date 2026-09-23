import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import WorkflowResult from "../components/WorkflowResult"
import type { GenerateWorkflowResponse, Workflow } from "../types/workflow"

vi.mock("../components/WorkflowCanvas", () => ({
  default: ({ workflow }: { workflow: Workflow }) => (
    <div data-testid="workflow-canvas" data-workflow-title={workflow.title}>Canvas</div>
  ),
}))

afterEach(cleanup)

function resultFixture(): GenerateWorkflowResponse {
  return {
    workflow: {
      title: "Lead qualification workflow",
      description: "Qualifies and routes incoming leads.",
      nodes: [
        { id: "start", type: "start", title: "Receive lead", description: "A lead arrives.", application: null },
      ],
      edges: [],
    },
    generation: { model: "test-model", durationMs: 42 },
  }
}

describe("WorkflowResult", () => {
  it("renders workflow metadata and the canvas without an insights section", () => {
    const result = resultFixture()
    render(<WorkflowResult result={result} />)

    expect(screen.getByRole("heading", { name: result.workflow.title })).toBeInTheDocument()
    expect(screen.getByText(result.workflow.description)).toBeInTheDocument()
    expect(screen.getByTestId("workflow-canvas")).toHaveAttribute("data-workflow-title", result.workflow.title)
    expect(screen.queryByText("Insights")).not.toBeInTheDocument()
    expect(screen.queryByText("Assumptions")).not.toBeInTheDocument()
  })

  it("renders malicious-looking generated metadata only as text", () => {
    const result = resultFixture()
    result.workflow.title = '<img src=x onerror=alert("title")>'
    result.workflow.description = '<script>alert("description")</script>'
    render(<WorkflowResult result={result} />)

    expect(screen.getByRole("heading", { name: result.workflow.title })).toBeInTheDocument()
    expect(screen.getByText(result.workflow.description)).toBeInTheDocument()
    expect(document.querySelector("img")).not.toBeInTheDocument()
    expect(document.querySelector("script")).not.toBeInTheDocument()
  })

  it("offers no editing or workflow actions", () => {
    render(<WorkflowResult result={resultFixture()} />)

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(document.querySelector("input, textarea, [contenteditable]")).not.toBeInTheDocument()
  })
})
