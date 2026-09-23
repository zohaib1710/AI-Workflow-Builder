import type { GenerateWorkflowResponse } from "../types/workflow"
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

      <div className="workflow-result__canvas">
        <WorkflowCanvas workflow={workflow} />
      </div>
    </section>
  )
}

export default WorkflowResult
