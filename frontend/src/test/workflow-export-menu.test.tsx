import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import WorkflowExportMenu from "../components/editor/WorkflowExportMenu"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("WorkflowExportMenu", () => {
  it("disables download until a workflow has exportable content", () => {
    render(<WorkflowExportMenu hasContent={false} onExport={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Download workflow" })).toBeDisabled()
  })

  it("offers PNG and PDF actions and runs the selected format", async () => {
    const onExport = vi.fn().mockResolvedValue(undefined)
    render(<WorkflowExportMenu hasContent onExport={onExport} />)

    fireEvent.click(screen.getByRole("button", { name: "Download workflow" }))
    expect(screen.getByRole("menu", { name: "Download workflow" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("menuitem", { name: "PNG image" }))

    await waitFor(() => expect(onExport).toHaveBeenCalledWith("png"))
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("prevents duplicate exports and reports a safe failure", async () => {
    let resolveExport: (() => void) | undefined
    const onExport = vi.fn(() => new Promise<void>((resolve) => { resolveExport = resolve }))
    render(<WorkflowExportMenu hasContent onExport={onExport} />)

    fireEvent.click(screen.getByRole("button", { name: "Download workflow" }))
    const png = screen.getByRole("menuitem", { name: "PNG image" })
    fireEvent.click(png)
    fireEvent.click(png)
    expect(onExport).toHaveBeenCalledTimes(1)
    resolveExport?.()
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())

    const failingExport = vi.fn().mockRejectedValue(new Error("capture failed"))
    cleanup()
    render(<WorkflowExportMenu hasContent onExport={failingExport} />)
    fireEvent.click(screen.getByRole("button", { name: "Download workflow" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "PDF document" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be downloaded")
  })
})
