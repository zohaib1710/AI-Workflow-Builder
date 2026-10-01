import { createPortal } from "react-dom"

interface ArchiveWorkflowDialogProps {
  title: string | null
  isArchiving: boolean
  onCancel: () => void
  onArchive: () => void
}

function ArchiveWorkflowDialog({ title, isArchiving, onCancel, onArchive }: ArchiveWorkflowDialogProps) {
  if (!title) return null
  return createPortal((
    <div className="editor-dialog-backdrop" role="presentation">
      <section className="editor-dialog archive-workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-workflow-title">
        <h2 id="archive-workflow-title">Archive workflow?</h2>
        <p><strong>{title}</strong> will move to your Archived workflows. Its saved versions will be kept, and you can restore it at any time.</p>
        <div className="editor-dialog__actions">
          <button type="button" onClick={onCancel} disabled={isArchiving}>Cancel</button>
          <button type="button" onClick={onArchive} disabled={isArchiving}>{isArchiving ? "Archiving..." : "Archive workflow"}</button>
        </div>
      </section>
    </div>
  ), document.body)
}

export default ArchiveWorkflowDialog
