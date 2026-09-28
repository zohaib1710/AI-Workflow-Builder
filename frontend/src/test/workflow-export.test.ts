import { afterEach, describe, expect, it, vi } from "vitest"
import {
  WORKFLOW_EXPORT_PADDING,
  getWorkflowExportDimensions,
  sanitizeWorkflowFilename,
} from "../editor/workflowExport"

const toPng = vi.hoisted(() => vi.fn())
const jsPDF = vi.hoisted(() => vi.fn(function MockJsPdf() {
  return {
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    save: vi.fn(),
  }
}))

vi.mock("html-to-image", () => ({ toPng }))
vi.mock("jspdf", () => ({ jsPDF }))

afterEach(() => {
  toPng.mockReset()
  jsPDF.mockClear()
})

describe("workflow export helpers", () => {
  it("creates safe, readable filenames with a fallback", () => {
    expect(sanitizeWorkflowFilename("  Lead intake / approval  ")).toBe("lead-intake-approval")
    expect(sanitizeWorkflowFilename("Été & Q4")).toBe("ete-q4")
    expect(sanitizeWorkflowFilename("---")).toBe("workflow")
  })

  it("adds diagram padding and keeps normal exports at two times resolution", () => {
    const dimensions = getWorkflowExportDimensions({ width: 800, height: 400 })
    expect(dimensions).toEqual({
      width: 800 + WORKFLOW_EXPORT_PADDING * 2,
      height: 400 + WORKFLOW_EXPORT_PADDING * 2,
      pixelRatio: 2,
    })
  })

  it("reduces pixel ratio for unusually large diagrams instead of exceeding canvas limits", () => {
    const dimensions = getWorkflowExportDimensions({ width: 40_000, height: 20_000 })
    expect(dimensions.width).toBe(40_000 + WORKFLOW_EXPORT_PADDING * 2)
    expect(dimensions.height).toBe(20_000 + WORKFLOW_EXPORT_PADDING * 2)
    expect(dimensions.pixelRatio).toBeLessThan(1)
    expect(dimensions.pixelRatio).toBeGreaterThanOrEqual(0.25)
  })

  it("captures the full padded viewport and downloads PNG without changing the viewport", async () => {
    const { exportWorkflowDiagram } = await import("../editor/workflowExport")
    const viewport = document.createElement("div")
    let downloadedFilename: string | null = null
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFilename = this.download
    })
    toPng.mockResolvedValue("data:image/png;base64,diagram")

    await exportWorkflowDiagram({
      viewport,
      nodes: [{ id: "node", position: { x: 0, y: 0 }, data: {} }],
      bounds: { x: -20, y: 10, width: 800, height: 400 },
      title: "Lead intake",
      format: "png",
    })

    expect(toPng).toHaveBeenCalledWith(viewport, expect.objectContaining({
      width: 800 + WORKFLOW_EXPORT_PADDING * 2,
      height: 400 + WORKFLOW_EXPORT_PADDING * 2,
      pixelRatio: 2,
      style: expect.objectContaining({
        transform: `translate(${WORKFLOW_EXPORT_PADDING + 20}px, ${WORKFLOW_EXPORT_PADDING - 10}px)`,
      }),
    }))
    expect(click).toHaveBeenCalledTimes(1)
    expect(downloadedFilename).toBe("lead-intake.png")
  })

  it("fits the captured image and title onto one landscape PDF page", async () => {
    const { exportWorkflowDiagram } = await import("../editor/workflowExport")
    toPng.mockResolvedValue("data:image/png;base64,diagram")
    await exportWorkflowDiagram({
      viewport: document.createElement("div"),
      nodes: [{ id: "node", position: { x: 0, y: 0 }, data: {} }],
      bounds: { x: 0, y: 0, width: 2_000, height: 1_000 },
      title: "Lead intake",
      format: "pdf",
    })

    const pdf = jsPDF.mock.results[0]?.value
    expect(jsPDF).toHaveBeenCalledWith({ orientation: "landscape", unit: "mm", format: "a4", compress: true })
    expect(pdf.addImage).toHaveBeenCalledWith(
      "data:image/png;base64,diagram",
      "PNG",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      undefined,
      "FAST",
    )
    expect(pdf.text).toHaveBeenCalledWith("Lead intake", 14, 14)
    expect(pdf.save).toHaveBeenCalledWith("lead-intake.pdf")
  })
})
