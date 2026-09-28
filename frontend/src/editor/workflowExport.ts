import type { Node, Rect } from "@xyflow/react"

export type WorkflowExportFormat = "png" | "pdf"

export const WORKFLOW_EXPORT_PADDING = 64
const MAX_EXPORT_DIMENSION = 12_000
const MAX_EXPORT_PIXELS = 16_000_000

export interface WorkflowExportOptions {
  viewport: HTMLElement
  nodes: readonly Node[]
  bounds: Rect
  title: string
  format: WorkflowExportFormat
}

export interface WorkflowExportDimensions {
  width: number
  height: number
  pixelRatio: number
}

export function sanitizeWorkflowFilename(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
  return normalized || "workflow"
}

export function getWorkflowExportDimensions(bounds: Pick<Rect, "width" | "height">): WorkflowExportDimensions {
  const width = Math.max(1, Math.ceil(bounds.width + WORKFLOW_EXPORT_PADDING * 2))
  const height = Math.max(1, Math.ceil(bounds.height + WORKFLOW_EXPORT_PADDING * 2))
  const dimensionRatio = Math.min(2, MAX_EXPORT_DIMENSION / Math.max(width, height))
  const areaRatio = Math.min(2, Math.sqrt(MAX_EXPORT_PIXELS / (width * height)))
  const pixelRatio = Math.max(0.25, Math.min(2, dimensionRatio, areaRatio))
  return { width, height, pixelRatio }
}

function triggerDownload(dataUrl: string, filename: string) {
  const link = document.createElement("a")
  link.download = filename
  link.href = dataUrl
  link.click()
}

function captureOptions(bounds: Rect, dimensions: WorkflowExportDimensions) {
  return {
    cacheBust: true,
    backgroundColor: "#ffffff",
    width: dimensions.width,
    height: dimensions.height,
    pixelRatio: dimensions.pixelRatio,
    style: {
      width: `${dimensions.width}px`,
      height: `${dimensions.height}px`,
      transformOrigin: "0 0",
      transform: `translate(${WORKFLOW_EXPORT_PADDING - bounds.x}px, ${WORKFLOW_EXPORT_PADDING - bounds.y}px)`,
    },
  }
}

export async function exportWorkflowDiagram({ viewport, nodes, bounds, title, format }: WorkflowExportOptions): Promise<void> {
  if (nodes.length === 0) throw new Error("There is no workflow content to export.")
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
    throw new Error("The workflow is still rendering. Try the download again in a moment.")
  }

  const { toPng } = await import("html-to-image")
  const dimensions = getWorkflowExportDimensions(bounds)
  const dataUrl = await toPng(viewport, captureOptions(bounds, dimensions))
  const filename = sanitizeWorkflowFilename(title)

  if (format === "png") {
    triggerDownload(dataUrl, `${filename}.png`)
    return
  }

  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true })
  const pageWidth = 297
  const pageHeight = 210
  const margin = 14
  const titleHeight = 10
  const availableWidth = pageWidth - margin * 2
  const availableHeight = pageHeight - margin * 2 - titleHeight
  const scale = Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height)
  const imageWidth = dimensions.width * scale
  const imageHeight = dimensions.height * scale
  const imageX = (pageWidth - imageWidth) / 2
  const imageY = margin + titleHeight + (availableHeight - imageHeight) / 2

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(14)
  pdf.setTextColor(24, 24, 27)
  pdf.text(title || "Workflow", margin, margin)
  pdf.addImage(dataUrl, "PNG", imageX, imageY, imageWidth, imageHeight, undefined, "FAST")
  pdf.save(`${filename}.pdf`)
}
