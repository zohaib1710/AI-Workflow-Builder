import { useEffect, useState } from "react"
import { fingerprintSnapshot } from "../../editor/snapshotFingerprint"
import { listOwnedWorkflows, loadLatestWorkflow, type OwnedWorkflowSummary, type SavedWorkflow } from "../../editor/workflowRepository"
import type { EditorSnapshot } from "../../editor/types"

interface WorkflowLibraryProps {
  userId: string
  userEmail?: string | null
  refreshKey: number
  onCreate: () => void
  onOpen: (workflow: SavedWorkflow, snapshot: EditorSnapshot, fingerprint: string) => void
  onSignOut?: () => Promise<void>
}

type RetryTarget = { kind: "list" } | { kind: "open"; workflow: OwnedWorkflowSummary }

function WorkflowLibrary({ userId, userEmail, refreshKey, onCreate, onOpen, onSignOut }: WorkflowLibraryProps) {
  const [workflows, setWorkflows] = useState<OwnedWorkflowSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [retryTarget, setRetryTarget] = useState<RetryTarget | null>(null)

  const loadList = async () => {
    setIsLoading(true)
    setError(null)
    setRetryTarget(null)
    try {
      setWorkflows(await listOwnedWorkflows(userId))
    } catch {
      setRetryTarget({ kind: "list" })
      setError("We couldn't load your workflows. Check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadList() }, [userId, refreshKey])

  const openWorkflow = async (summary: OwnedWorkflowSummary) => {
    if (openingId) return
    setOpeningId(summary.id)
    setError(null)
    setRetryTarget(null)
    try {
      const saved = await loadLatestWorkflow(summary.id)
      if (!saved) throw new Error("No saved version was found for this workflow.")
      const snapshot: EditorSnapshot = { workflow: saved.workflow, nodePresentations: saved.nodePresentations, annotations: saved.annotations }
      onOpen(saved, snapshot, await fingerprintSnapshot(snapshot))
    } catch {
      setRetryTarget({ kind: "open", workflow: summary })
      setError("We couldn't open that workflow. It may have no saved version or its saved data may be invalid. Please retry.")
    } finally {
      setOpeningId(null)
    }
  }

  const retry = () => {
    if (retryTarget?.kind === "open") void openWorkflow(retryTarget.workflow)
    else void loadList()
  }

  return (
    <main className="workflow-library" aria-labelledby="workflow-library-title">
      <header className="workflow-library__header">
        <div><p className="workflow-library__eyebrow">AI Workflow Builder</p><h1 id="workflow-library-title">My workflows</h1><p>Open a saved workflow or start a new one.</p></div>
        <div className="workflow-library__actions">
          <button type="button" className="workflow-library__create" onClick={onCreate}><span aria-hidden="true">+</span> New workflow</button>
          {userEmail && <span className="workflow-library__user" title={userEmail}>{userEmail}</span>}
          {onSignOut && <button type="button" className="workflow-library__sign-out" onClick={() => void onSignOut()} disabled={isLoading || openingId !== null}>Sign out</button>}
        </div>
      </header>
      {isLoading && <p role="status" className="workflow-library__status">Loading your workflows...</p>}
      {error && <div className="workflow-library__error" role="alert"><span>{error}</span>{!isLoading && <button type="button" onClick={retry}>Retry</button>}</div>}
      {!isLoading && !error && workflows.length === 0 && <section className="workflow-library__empty"><h2>No saved workflows yet</h2><p>Create a workflow and it will appear here after it is saved.</p><button type="button" onClick={onCreate}>Generate a new workflow</button></section>}
      {!isLoading && workflows.length > 0 && <section className="workflow-library__grid" aria-label="Saved workflows">{workflows.map((workflow) => <article className="workflow-library__card" key={workflow.id}><div><h2>{workflow.title}</h2><p>{workflow.description}</p><time dateTime={workflow.updatedAt}>Updated {new Date(workflow.updatedAt).toLocaleDateString()}</time></div><button type="button" onClick={() => void openWorkflow(workflow)} disabled={openingId !== null}>{openingId === workflow.id ? "Opening..." : "Open workflow"}</button></article>)}</section>}
    </main>
  )
}

export default WorkflowLibrary
