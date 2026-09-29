import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SaveVersionDialog from "../components/editor/SaveVersionDialog"

describe("SaveVersionDialog", () => {
  it("submits a trimmed, bounded optional version name", () => {
    const onSave = vi.fn()
    render(<SaveVersionDialog open isSaving={false} onCancel={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText("Version name"), { target: { value: `  ${"x".repeat(120)}  ` } })
    fireEvent.click(screen.getByRole("button", { name: "Save version" }))
    expect(onSave).toHaveBeenCalledWith("x".repeat(100))
  })
})
