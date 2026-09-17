import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState, type ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import PromptPanel from "../components/PromptPanel"
import { PROMPT_MAX_LENGTH } from "../lib/constants"

type PromptPanelProps = ComponentProps<typeof PromptPanel>

afterEach(cleanup)

function promptPanelProps(overrides: Partial<PromptPanelProps> = {}): PromptPanelProps {
  return {
    value: "",
    isLoading: false,
    error: null,
    onChange: vi.fn(),
    onGenerate: vi.fn(),
    onClear: vi.fn(),
    onUseExample: vi.fn(),
    ...overrides,
  }
}

describe("PromptPanel", () => {
  it("renders accessible prompt controls and the character count", () => {
    render(<PromptPanel {...promptPanelProps()} />)

    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toBeInTheDocument()
    expect(screen.getByText(`0 / ${PROMPT_MAX_LENGTH}`)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate Workflow" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Use example prompt" })).toBeInTheDocument()
    expect(screen.getByRole("form", { name: "Describe your workflow" })).toHaveAttribute("aria-busy", "false")
  })

  it("blocks empty, whitespace-only, and oversized prompts", () => {
    const onGenerate = vi.fn()
    const { rerender } = render(<PromptPanel {...promptPanelProps({ onGenerate })} />)
    const generate = () => screen.getByRole("button", { name: "Generate Workflow" })

    expect(generate()).toBeDisabled()
    fireEvent.submit(screen.getByRole("form"))
    rerender(<PromptPanel {...promptPanelProps({ value: "   ", onGenerate })} />)
    expect(generate()).toBeDisabled()
    fireEvent.submit(screen.getByRole("form"))
    rerender(<PromptPanel {...promptPanelProps({ value: "a".repeat(PROMPT_MAX_LENGTH + 1), onGenerate })} />)
    expect(generate()).toBeDisabled()
    expect(screen.getByRole("textbox", { name: "Workflow prompt" })).toHaveAttribute("aria-invalid", "true")
    fireEvent.submit(screen.getByRole("form"))
    expect(onGenerate).not.toHaveBeenCalled()
  })

  it("submits a valid prompt once and blocks repeated submission after loading starts", () => {
    const onGenerate = vi.fn()
    const idleProps = promptPanelProps({ value: "Create a lead workflow", onGenerate })
    const { rerender } = render(<PromptPanel {...idleProps} />)

    expect(screen.getByRole("button", { name: "Generate Workflow" })).toBeEnabled()
    fireEvent.submit(screen.getByRole("form"))
    rerender(<PromptPanel {...idleProps} isLoading />)
    fireEvent.submit(screen.getByRole("form"))
    fireEvent.submit(screen.getByRole("form"))
    expect(onGenerate).toHaveBeenCalledTimes(1)
  })

  it("exposes an accessible loading state and disables prompt-changing actions", () => {
    render(<PromptPanel {...promptPanelProps({ value: "Create a workflow", isLoading: true })} />)

    expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true")
    expect(screen.getByRole("status")).toHaveTextContent("Generating workflow...")
    expect(screen.getByRole("button", { name: /Generating workflow/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Use example prompt" })).toBeDisabled()
  })

  it("renders only the controlled error as an alert", () => {
    render(<PromptPanel {...promptPanelProps({ error: "The backend could not be reached." })} />)
    expect(screen.getByRole("alert")).toHaveTextContent("The backend could not be reached.")
  })

  it("invokes clear and example callbacks", () => {
    const onClear = vi.fn()
    const onUseExample = vi.fn()
    render(<PromptPanel {...promptPanelProps({ onClear, onUseExample })} />)

    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    fireEvent.click(screen.getByRole("button", { name: "Use example prompt" }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onUseExample).toHaveBeenCalledTimes(1)
  })

  it("updates the controlled value and count without offering excluded actions", () => {
    function Harness() {
      const [value, setValue] = useState("")
      return <PromptPanel {...promptPanelProps({ value, onChange: setValue })} />
    }

    render(<Harness />)
    fireEvent.change(screen.getByRole("textbox", { name: "Workflow prompt" }), {
      target: { value: "New workflow" },
    })
    expect(screen.getByText(`12 / ${PROMPT_MAX_LENGTH}`)).toBeInTheDocument()
    expect(screen.queryByText(/Groq|OpenAI|API key|Authorization|Bearer/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /edit|save|export|share|execute|run workflow/i })).not.toBeInTheDocument()
  })
})
