interface EditorHeaderProps {
  workflowTitle: string | null
  onNewWorkflow: () => void
  insightsOpen: boolean
  onToggleInsights: () => void
}

function EditorHeader({ workflowTitle, onNewWorkflow, insightsOpen, onToggleInsights }: EditorHeaderProps) {
  return (
    <header className="editor-floating-controls" aria-label="Editor controls">
      <div className="editor-floating-controls__identity">
        <span className="editor-floating-controls__mark" aria-hidden="true">*</span>
        <div className="editor-floating-controls__titles">
          <h1 className="editor-floating-controls__product">AI Workflow Builder</h1>
          {workflowTitle && <h2 className="editor-floating-controls__workflow-title">{workflowTitle}</h2>}
        </div>
      </div>
      {workflowTitle && (
        <div className="editor-floating-controls__actions">
          <button
            id="insights-trigger"
            type="button"
            className="editor-floating-controls__new"
            aria-controls="insights-drawer-heading"
            aria-expanded={insightsOpen}
            onClick={onToggleInsights}
          >
            Insights
          </button>
          <button type="button" className="editor-floating-controls__new" onClick={onNewWorkflow}>
            <span aria-hidden="true">+</span>
            New workflow
          </button>
        </div>
      )}
    </header>
  )
}

export default EditorHeader
