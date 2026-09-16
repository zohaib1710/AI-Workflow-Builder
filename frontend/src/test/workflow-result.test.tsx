import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
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
      assumptions: ["The CRM is available.", "Lead records include an email address."],
      missingRequirements: ["Define the qualification threshold.", "Choose an escalation owner."],
      suggestions: ["Review the routing rules monthly.", "Track conversion outcomes."],
    },
    generation: { model: "test-model", durationMs: 42 },
  }
}

function sectionForHeading(name: string): HTMLElement {
  const section = screen.getByRole("heading", { name }).closest("section")
  if (!section) throw new Error(`No section found for ${name}`)
  return section
}

describe("WorkflowResult", () => {
  it("renders workflow metadata, the canvas, and insight items in backend order", () => {
    const result = resultFixture()
    render(<WorkflowResult result={result} />)

    expect(screen.getByRole("heading", { name: result.workflow.title })).toBeInTheDocument()
    expect(screen.getByText(result.workflow.description)).toBeInTheDocument()
    expect(screen.getByTestId("workflow-canvas")).toHaveAttribute("data-workflow-title", result.workflow.title)

    const expectedSections = [
      ["Assumptions", result.workflow.assumptions],
      ["Missing requirements", result.workflow.missingRequirements],
      ["Suggestions", result.workflow.suggestions],
    ] as const

    for (const [heading, items] of expectedSections) {
      const section = sectionForHeading(heading)
      expect(within(section).getAllByRole("listitem").map((item) => item.textContent)).toEqual(items)
    }
  })

  it("keeps every empty insight section visible without fabricating list items", () => {
    const result = resultFixture()
    result.workflow.assumptions = []
    result.workflow.missingRequirements = []
    result.workflow.suggestions = []
    render(<WorkflowResult result={result} />)

    expect(within(sectionForHeading("Assumptions")).getByText("No assumptions were identified.")).toBeInTheDocument()
    expect(within(sectionForHeading("Missing requirements")).getByText("No missing requirements were identified.")).toBeInTheDocument()
    expect(within(sectionForHeading("Suggestions")).getByText("No additional suggestions were provided.")).toBeInTheDocument()
    expect(screen.queryAllByRole("listitem")).toHaveLength(0)
    expect(screen.queryByText("[]")).not.toBeInTheDocument()
    expect(screen.queryByText("null")).not.toBeInTheDocument()
  })

  it("renders malicious-looking generated values only as text", () => {
    const result = resultFixture()
    result.workflow.title = '<img src=x onerror=alert("title")>'
    result.workflow.description = '<script>alert("description")</script>'
    result.workflow.assumptions = ["<img src=x onerror=alert('assumption')>"]
    result.workflow.missingRequirements = ["<script>alert('requirement')</script>"]
    result.workflow.suggestions = ["<strong>Run this</strong>"]
    render(<WorkflowResult result={result} />)

    expect(screen.getByRole("heading", { name: result.workflow.title })).toBeInTheDocument()
    expect(screen.getByText(result.workflow.description)).toBeInTheDocument()
    expect(screen.getByText(result.workflow.assumptions[0])).toBeInTheDocument()
    expect(screen.getByText(result.workflow.missingRequirements[0])).toBeInTheDocument()
    expect(screen.getByText(result.workflow.suggestions[0])).toBeInTheDocument()
    expect(document.querySelector("img")).not.toBeInTheDocument()
    expect(document.querySelector("script")).not.toBeInTheDocument()
    expect(document.querySelector("strong")).not.toBeInTheDocument()
  })

  it("offers no editing or workflow actions", () => {
    render(<WorkflowResult result={resultFixture()} />)

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(document.querySelector("input, textarea, [contenteditable]")).not.toBeInTheDocument()
  })
})
