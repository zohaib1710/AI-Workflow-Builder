import { useEditorState } from "../../editor/EditorContext"

function ValidationIndicator() {
  const state = useEditorState()
  if (!state) return null

  const isIterationAvailable = state.present.workflow.nodes.length > 0 && state.issues.length === 0
  if (state.present.workflow.nodes.length === 0) {
    return <p className="validation-indicator" role="status" data-ai-iteration-enabled="false">Workflow draft is empty</p>
  }
  if (state.issues.length === 0) {
    return <p className="validation-indicator validation-indicator--valid" role="status" data-ai-iteration-enabled={String(isIterationAvailable)}>Workflow valid</p>
  }

  return (
    <details className="validation-indicator" data-ai-iteration-enabled="false">
      <summary>{state.issues.length} workflow {state.issues.length === 1 ? "issue" : "issues"}</summary>
      <ul>
        {state.issues.map((issue, index) => <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? index}`}>{issue.message}</li>)}
      </ul>
    </details>
  )
}

export default ValidationIndicator
