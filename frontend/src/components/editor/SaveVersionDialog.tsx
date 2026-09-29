import { useState } from "react"

interface SaveVersionDialogProps { open: boolean; isSaving: boolean; onCancel: () => void; onSave: (name: string) => void }

function SaveVersionDialog({ open, isSaving, onCancel, onSave }: SaveVersionDialogProps) {
  const [name, setName] = useState("")
  if (!open) return null
  const submit = () => { onSave(name.trim().slice(0, 100)); setName("") }
  return (
    <div className="editor-dialog-backdrop" role="presentation">
      <section className="editor-dialog" role="dialog" aria-modal="true" aria-labelledby="save-version-title">
        <h2 id="save-version-title">Save workflow version</h2>
        <p>Optionally name this version so it is easier to identify later.</p>
        <label htmlFor="version-name">Version name</label>
        <input id="version-name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="e.g. Added lead routing" autoFocus disabled={isSaving} />
        <div className="editor-dialog__actions">
          <button type="button" onClick={onCancel} disabled={isSaving}>Cancel</button>
          <button type="button" onClick={submit} disabled={isSaving}>{isSaving ? "Saving..." : "Save version"}</button>
        </div>
      </section>
    </div>
  )
}
export default SaveVersionDialog
