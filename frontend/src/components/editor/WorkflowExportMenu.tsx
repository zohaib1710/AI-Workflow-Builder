import { useEffect, useRef, useState } from "react"
import type { WorkflowExportFormat } from "../../editor/workflowExport"

interface WorkflowExportMenuProps {
  disabled?: boolean
  hasContent: boolean
  isRequestLoading?: boolean
  onExport: (format: WorkflowExportFormat) => Promise<void>
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function ExportTypeIcon({ format }: { format: WorkflowExportFormat }) {
  return format === "png" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 4-4 3 3 2-2 5 5" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>
  )
}function WorkflowExportMenu({ disabled = false, hasContent, isRequestLoading = false, onExport }: WorkflowExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isDisabled = disabled || !hasContent || isRequestLoading || isExporting

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const runExport = async (format: WorkflowExportFormat) => {
    if (isDisabled) return
    setError(null)
    setIsExporting(true)
    try {
      await onExport(format)
      setOpen(false)
    } catch {
      setError("The workflow could not be downloaded. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div ref={menuRef} className="editor-export-menu">
      <button
        type="button"
        className="editor-floating-controls__new editor-export-menu__trigger"
        aria-label="Download workflow"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={isExporting}
        disabled={isDisabled}
        title={hasContent ? "Download workflow" : "Generate a workflow before downloading"}
        onClick={() => setOpen((current) => !current)}
      >
        <DownloadIcon />
        <span>Download</span>
      </button>
      {open && !isDisabled && (
        <div className="editor-export-menu__popup" role="menu" aria-label="Download workflow">
          <button type="button" role="menuitem" disabled={isExporting} onClick={() => void runExport("png")}>
            <span className="editor-export-menu__item-icon" aria-hidden="true"><ExportTypeIcon format="png" /></span>
            PNG image
          </button>
          <button type="button" role="menuitem" disabled={isExporting} onClick={() => void runExport("pdf")}>
            <span className="editor-export-menu__item-icon" aria-hidden="true"><ExportTypeIcon format="pdf" /></span>
            PDF document
          </button>
          {isExporting && <p className="editor-export-menu__status" role="status">Preparing download…</p>}
          {error && <p className="editor-export-menu__error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}

export default WorkflowExportMenu
