import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface RenameWorkflowDialogProps {
  title: string | null
  isRenaming: boolean
  error: string | null
  onCancel: () => void
  onRename: (title: string) => void
}

function RenameWorkflowDialog({ title, isRenaming, error, onCancel, onRename }: RenameWorkflowDialogProps) {
  const [value, setValue] = useState(title ?? "")

  useEffect(() => setValue(title ?? ""), [title])
  if (!title) return null
  const normalized = value.trim()
  const unchanged = normalized === title.trim()
  const invalid = !normalized || normalized.length > 100

  return createPortal((
    <div className="editor-dialog-backdrop" role="presentation">
      <section className="editor-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-workflow-title">
        <h2 id="rename-workflow-title">Rename workflow</h2>
        <p>Choose a clear name for this workflow. The current saved version will remain in history.</p>
        <label htmlFor="workflow-new-title">Workflow name</label>
        <input id="workflow-new-title" value={value} maxLength={100} onChange={(event) => setValue(event.target.value)} autoFocus disabled={isRenaming} aria-invalid={Boolean(error)} />
        <p className="rename-dialog__count">{normalized.length} / 100</p>
        {error && <p className="rename-dialog__error" role="alert">{error}</p>}
        <div className="editor-dialog__actions">
          <button type="button" onClick={onCancel} disabled={isRenaming}>Cancel</button>
          <button type="button" onClick={() => onRename(normalized)} disabled={invalid || unchanged || isRenaming}>{isRenaming ? "Renaming..." : "Rename"}</button>
        </div>
      </section>
    </div>
  ), document.body)
}

export default RenameWorkflowDialog
