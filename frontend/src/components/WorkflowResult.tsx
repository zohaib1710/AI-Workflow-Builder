import type { GenerateWorkflowResponse } from "../types/workflow"
import WorkflowCanvas from "./WorkflowCanvas"

interface WorkflowResultProps {
  result: GenerateWorkflowResponse
}

function WorkflowResult({ result }: WorkflowResultProps) {
  return (
    <section aria-labelledby="workflow-result-heading" className="workflow-result">
      <h2 id="workflow-result-heading" className="sr-only">Generated workflow diagram</h2>
      <WorkflowCanvas workflow={result.workflow} />
    </section>
  )
}

export default WorkflowResult
