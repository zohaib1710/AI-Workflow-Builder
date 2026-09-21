import { useEffect, useRef } from "react"
import InsightPanel from "../InsightPanel"
import type { Workflow } from "../../types/workflow"

interface InsightsDrawerProps {
  workflow: Workflow
  onClose: () => void
}

function InsightsDrawer({ workflow, onClose }: InsightsDrawerProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      const target = event.target
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <aside className="insights-drawer" aria-labelledby="insights-drawer-heading">
      <div className="insights-drawer__header">
        <h2 id="insights-drawer-heading" ref={headingRef} tabIndex={-1}>Workflow insights</h2>
        <button type="button" aria-label="Close insights" onClick={onClose}>Close</button>
      </div>
      <div className="insights-drawer__content">
        <InsightPanel title="Assumptions" items={workflow.assumptions} emptyMessage="No assumptions were identified." />
        <InsightPanel title="Missing requirements" items={workflow.missingRequirements} emptyMessage="No missing requirements were identified." />
        <InsightPanel title="Suggestions" items={workflow.suggestions} emptyMessage="No additional suggestions were provided." />
      </div>
    </aside>
  )
}

export default InsightsDrawer
