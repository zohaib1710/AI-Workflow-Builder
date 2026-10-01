import { useEffect, useState } from "react"
import { fingerprintSnapshot } from "../../editor/snapshotFingerprint"
import { archiveWorkflow, listWorkflowLibrary, loadLatestWorkflow, renameWorkflow, restoreWorkflow, type ArchivedWorkflowSummary, type OwnedWorkflowSummary, type SavedWorkflow } from "../../editor/workflowRepository"
import type { EditorSnapshot } from "../../editor/types"
import Icon from "./EditorIcons"
import RenameWorkflowDialog from "./RenameWorkflowDialog"
import ArchiveWorkflowDialog from "./ArchiveWorkflowDialog"

interface WorkflowLibraryProps {
  userId: string
  userEmail?: string | null
  refreshKey: number
  onCreate: () => void
  onOpen: (workflow: SavedWorkflow, snapshot: EditorSnapshot, fingerprint: string) => void
  onSignOut?: () => Promise<void>
}

type RetryTarget = { kind: "list" } | { kind: "open"; workflow: OwnedWorkflowSummary } | { kind: "archive"; workflow: OwnedWorkflowSummary } | { kind: "restore"; workflow: ArchivedWorkflowSummary }

function WorkflowLibrary({ userId, userEmail, refreshKey, onCreate, onOpen, onSignOut }: WorkflowLibraryProps) {
  const [workflows, setWorkflows] = useState<OwnedWorkflowSummary[]>([])
  const [archivedWorkflows, setArchivedWorkflows] = useState<ArchivedWorkflowSummary[]>([])
  const [view, setView] = useState<"active" | "archived">("active")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [retryTarget, setRetryTarget] = useState<RetryTarget | null>(null)
  const [renameTarget, setRenameTarget] = useState<OwnedWorkflowSummary | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<OwnedWorkflowSummary | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [busyArchiveId, setBusyArchiveId] = useState<string | null>(null)

  const loadList = async () => {
    setIsLoading(true)
    setError(null)
    setRetryTarget(null)
    try {
      const library = await listWorkflowLibrary(userId)
      setWorkflows(library.active)
      setArchivedWorkflows(library.archived)
    } catch {
      setRetryTarget({ kind: "list" })
      setError("We couldn't load your workflows and archive status. Check your connection and try again.")
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
    else if (retryTarget?.kind === "archive") {
      const workflow = retryTarget.workflow
      setIsArchiving(true)
      setError(null)
      void archiveWorkflow(workflow.id, userId).then(async () => {
        setArchiveTarget(null)
        await loadList()
        setView("active")
        setNotice(`"${workflow.title}" moved to Archived workflows.`)
      }).catch(() => {
        setRetryTarget({ kind: "archive", workflow })
        setError("We couldn't archive this workflow. Check your connection and try again.")
      }).finally(() => setIsArchiving(false))
    }
    else if (retryTarget?.kind === "restore") void handleRestore(retryTarget.workflow)
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
      setNotice(`Workflow renamed to "${title}".`)
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

  const handleArchive = async () => {
    if (!archiveTarget || isArchiving) return
    const target = archiveTarget
    setIsArchiving(true)
    setError(null)
    try {
      await archiveWorkflow(target.id, userId)
      setArchiveTarget(null)
      await loadList()
      setView("active")
      setNotice(`"${target.title}" moved to Archived workflows. You can restore it at any time.`)
    } catch (failure: unknown) {
      setArchiveTarget(null)
      setError(failure instanceof TypeError ? "We couldn't reach Supabase. Check your connection and try again." : "We couldn't archive this workflow. Check your connection and try again.")
      setRetryTarget({ kind: "archive", workflow: target })
    } finally {
      setIsArchiving(false)
    }
  }

  const handleRestore = async (workflow: ArchivedWorkflowSummary) => {
    if (busyArchiveId) return
    setBusyArchiveId(workflow.id)
    setError(null)
    try {
      await restoreWorkflow(workflow.id, userId)
      await loadList()
      setView("active")
      setNotice(`"${workflow.title}" restored to Active workflows.`)
    } catch (failure: unknown) {
      setError(failure instanceof TypeError ? "We couldn't reach Supabase. Check your connection and try again." : "We couldn't restore this workflow. Check your connection and try again.")
      setRetryTarget({ kind: "restore", workflow })
    } finally {
      setBusyArchiveId(null)
    }
  }

  const visibleWorkflows = view === "active" ? workflows : archivedWorkflows

  return (
    <main className="workflow-library" aria-labelledby="workflow-library-title">
      <header className="workflow-library__header">
        <div><p className="workflow-library__eyebrow"><span aria-hidden="true"><Icon name="brand" /></span> Systemapic Workflow Builder</p><h1 id="workflow-library-title">My workflows</h1><p>Open a saved workflow or start a new one.</p></div>
        <div className="workflow-library__actions">
          <button type="button" className="workflow-library__create" onClick={onCreate}><Icon name="plus" aria-hidden="true" /> New workflow</button>
          {userEmail && <span className="workflow-library__user" title={userEmail}>{userEmail}</span>}
          {onSignOut && <button type="button" className="workflow-library__sign-out" onClick={() => void onSignOut()} disabled={isLoading || openingId !== null}>Sign out</button>}
        </div>
      </header>
      <nav className="workflow-library__views" aria-label="Workflow status">
        <button type="button" aria-pressed={view === "active"} onClick={() => { setView("active"); setError(null) }}>Active <span>{workflows.length}</span></button>
        <button type="button" aria-pressed={view === "archived"} onClick={() => { setView("archived"); setError(null) }}>Archived <span>{archivedWorkflows.length}</span></button>
      </nav>
      {isLoading && <p role="status" className="workflow-library__status">Loading your workflows...</p>}
      {notice && <p role="status" className="workflow-library__notice">{notice}</p>}
      {error && <div className="workflow-library__error" role="alert"><span>{error}</span>{!isLoading && <button type="button" onClick={retry}>Retry</button>}</div>}
      {!isLoading && (!error || retryTarget?.kind !== "list") && visibleWorkflows.length === 0 && <section className="workflow-library__empty"><h2>{view === "active" ? "No active workflows" : "No archived workflows"}</h2><p>{view === "active" ? "Create a workflow and it will appear here after it is saved." : "Workflows you archive will appear here. You can restore them at any time."}</p>{view === "active" && <button type="button" onClick={onCreate}>Generate a new workflow</button>}</section>}
      {!isLoading && (!error || retryTarget?.kind !== "list") && view === "active" && workflows.length > 0 && <section className="workflow-library__grid" aria-label="Active workflows">{workflows.map((workflow) => <article className="workflow-library__card" key={workflow.id}><div><h2>{workflow.title}</h2><p>{workflow.description}</p><time dateTime={workflow.updatedAt}>Updated {new Date(workflow.updatedAt).toLocaleDateString()}</time></div><div className="workflow-library__card-actions"><button type="button" className="workflow-library__rename" onClick={() => { setRenameTarget(workflow); setRenameError(null) }} disabled={isRenaming || isArchiving || busyArchiveId !== null}>Rename</button><button type="button" className="workflow-library__archive" onClick={() => setArchiveTarget(workflow)} disabled={isArchiving || busyArchiveId !== null || openingId !== null}>Archive</button><button type="button" onClick={() => void openWorkflow(workflow)} disabled={openingId !== null || isRenaming || isArchiving || busyArchiveId !== null}>{openingId === workflow.id ? "Opening..." : "Open workflow"}</button></div></article>)}</section>}
      {!isLoading && (!error || retryTarget?.kind !== "list") && view === "archived" && archivedWorkflows.length > 0 && <section className="workflow-library__grid" aria-label="Archived workflows">{archivedWorkflows.map((workflow) => <article className="workflow-library__card" key={workflow.id}><div><h2>{workflow.title}</h2><p>{workflow.description}</p><time dateTime={workflow.archivedAt}>Archived {new Date(workflow.archivedAt).toLocaleDateString()}</time></div><div className="workflow-library__card-actions"><button type="button" onClick={() => void handleRestore(workflow)} disabled={busyArchiveId !== null || isRenaming || isArchiving}>{busyArchiveId === workflow.id ? "Restoring..." : "Restore"}</button></div></article>)}</section>}
      <RenameWorkflowDialog title={renameTarget?.title ?? null} isRenaming={isRenaming} error={renameError} onCancel={() => { if (!isRenaming) setRenameTarget(null) }} onRename={(title) => void handleRename(title)} />
      <ArchiveWorkflowDialog title={archiveTarget?.title ?? null} isArchiving={isArchiving} onCancel={() => { if (!isArchiving) setArchiveTarget(null) }} onArchive={() => void handleArchive()} />
    </main>
  )
}

export default WorkflowLibrary
