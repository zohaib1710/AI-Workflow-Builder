import type { WorkflowExportFormat } from "../../editor/workflowExport"
import Icon from "./EditorIcons"
import WorkflowExportMenu from "./WorkflowExportMenu"

interface EditorHeaderProps {
  workflowTitle: string | null
  hasExportableContent: boolean
  isRequestLoading: boolean
  onNewWorkflow: () => void
  onExport: (format: WorkflowExportFormat) => Promise<void>
  onSave?: () => Promise<void>
  isSaving?: boolean
  saveStatus?: string | null
  userEmail?: string | null
  onSignOut?: () => Promise<void>
}

function EditorHeader({ workflowTitle, hasExportableContent, isRequestLoading, onNewWorkflow, onExport, onSave, isSaving = false, saveStatus, userEmail, onSignOut }: EditorHeaderProps) {
  return (
    <header className="editor-floating-controls" aria-label="Editor controls">
      <div className="editor-floating-controls__identity">
        <span className="editor-floating-controls__mark" aria-hidden="true"><Icon name="brand" /></span>
        <div className="editor-floating-controls__titles">
          <h1 className="editor-floating-controls__product">AI Workflow Builder</h1>
          {workflowTitle && <h2 className="editor-floating-controls__workflow-title">{workflowTitle}</h2>}
        </div>
      </div>
      {workflowTitle && (
        <div className="editor-floating-controls__actions">
          {onSave && <button type="button" className="editor-floating-controls__new" onClick={() => void onSave()} disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>}
          {saveStatus && <span className="editor-floating-controls__save-status" role="status">{saveStatus}</span>}
          {hasExportableContent && <WorkflowExportMenu hasContent isRequestLoading={isRequestLoading} onExport={onExport} />}
          <button type="button" className="editor-floating-controls__new editor-floating-controls__new--primary" onClick={onNewWorkflow} disabled={isRequestLoading || isSaving}>
            <Icon name="plus" aria-hidden="true" />
            New workflow
          </button>
        </div>
      )}
      {(userEmail || onSignOut) && (
        <div className="editor-floating-controls__account-actions">
          {userEmail && <span className="editor-floating-controls__user" title={userEmail}>{userEmail}</span>}
          {onSignOut && <button type="button" className="editor-floating-controls__new" onClick={() => void onSignOut()} disabled={isRequestLoading || isSaving}>Sign out</button>}
        </div>
      )}
    </header>
  )
}

export default EditorHeader
