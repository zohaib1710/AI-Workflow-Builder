import type { WorkflowExportFormat } from "../../editor/workflowExport"
import Icon from "./EditorIcons"
import WorkflowExportMenu from "./WorkflowExportMenu"

interface EditorHeaderProps {
  workflowTitle: string | null
  hasExportableContent: boolean
  isRequestLoading: boolean
  onNewWorkflow: () => void
  onExport: (format: WorkflowExportFormat) => Promise<void>
}

function EditorHeader({ workflowTitle, hasExportableContent, isRequestLoading, onNewWorkflow, onExport }: EditorHeaderProps) {
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
          {hasExportableContent && (
            <WorkflowExportMenu
              hasContent
              isRequestLoading={isRequestLoading}
              onExport={onExport}
            />
          )}
          <button type="button" className="editor-floating-controls__new editor-floating-controls__new--primary" onClick={onNewWorkflow}>
            <Icon name="plus" aria-hidden="true" />
            New workflow
          </button>
        </div>
      )}
    </header>
  )
}

export default EditorHeader
