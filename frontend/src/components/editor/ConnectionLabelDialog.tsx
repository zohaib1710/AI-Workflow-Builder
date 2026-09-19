import { useState, type FormEvent, type KeyboardEvent } from "react"

export interface ConnectionLabelDialogProps {
  disabled: boolean
  onCancel: () => void
  onConfirm: (label: string) => void
}

function ConnectionLabelDialog({ disabled, onCancel, onConfirm }: ConnectionLabelDialogProps) {
  const [label, setLabel] = useState("")
  const normalizedLabel = label.trim()

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (disabled || !normalizedLabel) return
    onConfirm(normalizedLabel)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return
    event.preventDefault()
    onCancel()
  }

  return (
    <div className="connection-label-dialog" role="dialog" aria-modal="true" aria-labelledby="connection-label-title" onKeyDown={handleKeyDown}>
      <form onSubmit={submit}>
        <h2 id="connection-label-title">Label decision branch</h2>
        <label>
          <span>Branch label</span>
          <input autoFocus value={label} disabled={disabled} onChange={(event) => setLabel(event.target.value)} placeholder="For example, Yes" />
        </label>
        <div className="connection-label-dialog__actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={disabled || !normalizedLabel}>Add connection</button>
        </div>
      </form>
    </div>
  )
}

export default ConnectionLabelDialog
