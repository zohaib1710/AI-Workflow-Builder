import type { GenerateWorkflowResponse } from "../types/workflow"
import InsightPanel from "./InsightPanel"
import WorkflowCanvas from "./WorkflowCanvas"

interface WorkflowResultProps {
  result: GenerateWorkflowResponse
}

function WorkflowResult({ result }: WorkflowResultProps) {
  const { workflow } = result

  return (
    <section aria-labelledby="workflow-result-heading" className="workflow-result">
      <header className="workflow-result__header">
        <p className="workflow-result__eyebrow">Workflow result</p>
        <h2 id="workflow-result-heading" className="workflow-result__title">{workflow.title}</h2>
        <p className="workflow-result__description">{workflow.description}</p>
      </header>

      <div className="workflow-result__grid">
        <div className="workflow-result__canvas">
          <WorkflowCanvas workflow={workflow} />
        </div>

        <aside className="workflow-insights" aria-label="Workflow insights">
          <InsightPanel title="Assumptions" items={workflow.assumptions} emptyMessage="No assumptions were identified." />
          <InsightPanel title="Missing requirements" items={workflow.missingRequirements} emptyMessage="No missing requirements were identified." />
          <InsightPanel title="Suggestions" items={workflow.suggestions} emptyMessage="No additional suggestions were provided." />
        </aside>
      </div>
    </section>
  )
}

export default WorkflowResult
