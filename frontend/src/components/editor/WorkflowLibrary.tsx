import { useEffect, useState } from "react"
import { fingerprintSnapshot } from "../../editor/snapshotFingerprint"
import { listOwnedWorkflows, loadLatestWorkflow, renameWorkflow, type OwnedWorkflowSummary, type SavedWorkflow } from "../../editor/workflowRepository"
import type { EditorSnapshot } from "../../editor/types"
import Icon from "./EditorIcons"
import RenameWorkflowDialog from "./RenameWorkflowDialog"

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
  const [renameTarget, setRenameTarget] = useState<OwnedWorkflowSummary | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

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

  const handleRename = async (title: string) => {
    if (!renameTarget || isRenaming) return
    setIsRenaming(true)
    setRenameError(null)
    try {
      await renameWorkflow(renameTarget.id, title)
      setRenameTarget(null)
      await loadList()
      setNotice(`Workflow renamed to “${title}”.`)
    } catch (renameFailure: unknown) {
      const code = renameFailure && typeof renameFailure === "object" && "code" in renameFailure ? String(renameFailure.code) : ""
      if (code === "42501") setRenameError("You don't have permission to rename this workflow.")
      else if (code === "42883" || code === "PGRST202") setRenameError("Rename is not set up yet. Apply the provided Supabase migration, then try again.")
      else if (renameFailure instanceof TypeError) setRenameError("We couldn't reach Supabase. Check your connection and try again.")
      else setRenameError("We couldn't rename this workflow. Please try again.")
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <main className="workflow-library" aria-labelledby="workflow-library-title">
      <header className="workflow-library__header">
        <div><p className="workflow-library__eyebrow"><span aria-hidden="true"><Icon name="brand" /></span> AI Workflow Builder</p><h1 id="workflow-library-title">My workflows</h1><p>Open a saved workflow or start a new one.</p></div>
        <div className="workflow-library__actions">
          <button type="button" className="workflow-library__create" onClick={onCreate}><Icon name="plus" aria-hidden="true" /> New workflow</button>
          {userEmail && <span className="workflow-library__user" title={userEmail}>{userEmail}</span>}
          {onSignOut && <button type="button" className="workflow-library__sign-out" onClick={() => void onSignOut()} disabled={isLoading || openingId !== null}>Sign out</button>}
        </div>
      </header>
      {isLoading && <p role="status" className="workflow-library__status">Loading your workflows...</p>}
      {notice && <p role="status" className="workflow-library__notice">{notice}</p>}
      {error && <div className="workflow-library__error" role="alert"><span>{error}</span>{!isLoading && <button type="button" onClick={retry}>Retry</button>}</div>}
      {!isLoading && !error && workflows.length === 0 && <section className="workflow-library__empty"><h2>No saved workflows yet</h2><p>Create a workflow and it will appear here after it is saved.</p><button type="button" onClick={onCreate}>Generate a new workflow</button></section>}
      {!isLoading && workflows.length > 0 && <section className="workflow-library__grid" aria-label="Saved workflows">{workflows.map((workflow) => <article className="workflow-library__card" key={workflow.id}><div><h2>{workflow.title}</h2><p>{workflow.description}</p><time dateTime={workflow.updatedAt}>Updated {new Date(workflow.updatedAt).toLocaleDateString()}</time></div><div className="workflow-library__card-actions"><button type="button" className="workflow-library__rename" onClick={() => { setRenameTarget(workflow); setRenameError(null) }} disabled={isRenaming}>Rename</button><button type="button" onClick={() => void openWorkflow(workflow)} disabled={openingId !== null || isRenaming}>{openingId === workflow.id ? "Opening..." : "Open workflow"}</button></div></article>)}</section>}
      <RenameWorkflowDialog title={renameTarget?.title ?? null} isRenaming={isRenaming} error={renameError} onCancel={() => { if (!isRenaming) setRenameTarget(null) }} onRename={(title) => void handleRename(title)} />
    </main>
  )
}

export default WorkflowLibrary
