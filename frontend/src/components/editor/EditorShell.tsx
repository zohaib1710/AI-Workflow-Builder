import { useCallback, useEffect, useRef, useState } from "react"
import { editWorkflow, generateWorkflow, WorkflowApiError } from "../../api/client"
import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import { reconcileWorkflowPresentation } from "../../editor/reconcileWorkflow"
import { createInitialEditorState } from "../../editor/editorReducer"
import { createWorkflowRecord, loadWorkflowVersion, saveWorkflowVersion } from "../../editor/workflowRepository"
import { fingerprintSnapshot } from "../../editor/snapshotFingerprint"
import type { CanvasNodePresentation, CanvasPosition } from "../../editor/types"
import { validateWorkflowDraft } from "../../editor/validation"
import { EXAMPLE_PROMPT, PROMPT_MAX_LENGTH } from "../../lib/constants"
import EditorHeader from "./EditorHeader"
import EditorToolbar from "./EditorToolbar"
import InspectorPanel from "./InspectorPanel"
import ValidationIndicator from "./ValidationIndicator"
import WorkflowEditorCanvas, { type WorkflowEditorCanvasHandle } from "./WorkflowEditorCanvas"
import WorkflowPromptComposer from "./WorkflowPromptComposer"
import type { WorkflowExportFormat } from "../../editor/workflowExport"
import VersionHistoryDrawer from "./VersionHistoryDrawer"

export interface EditorShellProps {
  userId?: string
  accessToken?: string | null
  userEmail?: string | null
  onSignOut?: () => Promise<void>
  workflowId?: string
  initialSavedFingerprint?: string | null
  initialLatestSavedVersionNumber?: number | null
  onBackToLibrary?: () => void
}

const IDENTITY_INSTABILITY_MESSAGE = "The revised workflow could not preserve the current canvas layout. Try a more specific edit."

function friendlyPersistenceError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : ""
  if (code === "42501") return "Save failed because your account does not have permission to write workflows. Check the Supabase table policies."
  if (code === "23505") return "Save failed because this version already exists. Please try again."
  return "Save failed. Please check your connection and try again."
}

function presentationCenter(
  presentation: Record<string, CanvasNodePresentation>,
): CanvasPosition {
  const positions = Object.values(presentation).map((node) => node.position)
  if (positions.length === 0) return { x: 0, y: 0 }

  const xs = positions.map((position) => position.x)
  const ys = positions.map((position) => position.y)
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
}

function focusValidationIndicator() {
  globalThis.requestAnimationFrame(() => {
    const indicator = document.querySelector<HTMLElement>(".validation-indicator")
    if (!indicator) return
    if (indicator instanceof HTMLDetailsElement) {
      indicator.open = true
      indicator.querySelector<HTMLElement>("summary")?.focus()
      return
    }
    indicator.tabIndex = -1
    indicator.focus()
  })
}

function useEditingViewport() {
  const query = "(min-width: 768px)"
  const [matches, setMatches] = useState(() => typeof window === "undefined" || typeof window.matchMedia !== "function" ? true : window.matchMedia(query).matches)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const media = window.matchMedia(query)
    const update = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return matches
}

function EditorShell({ userId, accessToken, userEmail, onSignOut, workflowId, initialSavedFingerprint, initialLatestSavedVersionNumber, onBackToLibrary }: EditorShellProps) {
  const editorState = useEditorState()
  const dispatch = useEditorDispatch()
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedWorkflowId, setSavedWorkflowId] = useState<string | null>(workflowId ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [currentFingerprint, setCurrentFingerprint] = useState<string | null>(null)
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(initialSavedFingerprint ?? null)
  const [latestSavedVersionNumber, setLatestSavedVersionNumber] = useState<number | null>(initialLatestSavedVersionNumber ?? null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoredVersion, setRestoredVersion] = useState<{ versionNumber: number; fingerprint: string } | null>(null)
  const [isHashing, setIsHashing] = useState(false)
  const requestInFlight = useRef(false)
  const fingerprintRequest = useRef(0)
  const isMounted = useRef(true)
  const canvasRef = useRef<WorkflowEditorCanvasHandle | null>(null)
  const editingViewport = useEditingViewport()
  const workflow = editorState?.present.workflow ?? null
  const isEditing = editorState?.asyncState.status === "loading"
  const isRequestLoading = isGenerating || isEditing || isRestoring
  const hasExportableContent = Boolean(workflow && (workflow.nodes.length > 0 || editorState?.present.annotations.length))
  const canSave = Boolean(userId && workflow && currentFingerprint && currentFingerprint !== savedFingerprint && !isHashing && !isSaving && !isRequestLoading)

  useEffect(() => {
    const snapshot = editorState?.present
    if (!snapshot) {
      setCurrentFingerprint(null)
      setIsHashing(false)
      return
    }
    const request = ++fingerprintRequest.current
    setIsHashing(true)
    void fingerprintSnapshot(snapshot).then((fingerprint) => {
      if (request !== fingerprintRequest.current) return
      setCurrentFingerprint(fingerprint)
      setIsHashing(false)
    })
  }, [editorState?.present])

  const handleExport = useCallback(async (format: WorkflowExportFormat) => {
    if (!canvasRef.current) throw new Error("The workflow canvas is not ready.")
    await canvasRef.current.exportWorkflow(format)
  }, [])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const handleGenerate = async () => {
    if (workflow || requestInFlight.current) return
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt) {
      setError("Enter a workflow prompt before generating.")
      return
    }
    if (normalizedPrompt.length > PROMPT_MAX_LENGTH) {
      setError("The workflow prompt must be 2,000 characters or fewer.")
      return
    }

    requestInFlight.current = true
    setError(null)
    setSaveStatus(null)
    setIsGenerating(true)
    try {
      const response = accessToken
        ? await generateWorkflow({ prompt: normalizedPrompt }, { accessToken })
        : await generateWorkflow({ prompt: normalizedPrompt })
      if (!isMounted.current) return
      dispatch({ type: "workflow/adopt", workflow: response.workflow })
      if (userId) {
        try {
          const initialSnapshot = createInitialEditorState(response.workflow).present
          const workflowId = await createWorkflowRecord(userId, initialSnapshot)
          if (isMounted.current) {
            setSavedWorkflowId(workflowId)
            setLatestSavedVersionNumber(1)
            setSavedFingerprint(await fingerprintSnapshot(initialSnapshot))
          }
        } catch (persistenceError: unknown) {
          if (isMounted.current) setSaveStatus(friendlyPersistenceError(persistenceError))
        }
      }
      setPrompt("")
    } catch (generationError: unknown) {
      if (!isMounted.current) return
      setError(
        generationError instanceof WorkflowApiError
          ? generationError.message
          : "Something went wrong while generating the workflow. Please try again.",
      )
    } finally {
      requestInFlight.current = false
      if (isMounted.current) setIsGenerating(false)
    }
  }

  const handleIterate = async () => {
    if (!workflow || !editorState || requestInFlight.current) return
    const normalizedInstruction = prompt.trim()
    if (!normalizedInstruction) {
      setError("Enter an edit instruction before updating.")
      return
    }
    if (normalizedInstruction.length > PROMPT_MAX_LENGTH) {
      setError("The edit instruction must be 2,000 characters or fewer.")
      return
    }
    if (workflow.nodes.length === 0 || validateWorkflowDraft(workflow).length > 0) {
      setError("Resolve the workflow validation issues before asking AI to update it.")
      focusValidationIndicator()
      return
    }

    const previous = editorState.present
    requestInFlight.current = true
    setError(null)
    dispatch({ type: "async/set", asyncState: { status: "loading" } })
    try {
      const editRequest = {
        instruction: normalizedInstruction,
        workflow: previous.workflow,
      }
      const response = accessToken
        ? await editWorkflow(editRequest, { accessToken })
        : await editWorkflow(editRequest)
      if (!isMounted.current) return

      const reconciliation = reconcileWorkflowPresentation(
        previous.workflow,
        previous.nodePresentations,
        response.workflow,
        presentationCenter(previous.nodePresentations),
      )
      if (reconciliation.status === "identity-instability") {
        setError(IDENTITY_INSTABILITY_MESSAGE)
        return
      }

      dispatch({
        type: "snapshot/record",
        snapshot: {
          workflow: response.workflow,
          nodePresentations: reconciliation.presentation,
          annotations: previous.annotations,
        },
      })
      setPrompt("")
      setError(null)
    } catch (editError: unknown) {
      if (!isMounted.current) return
      setError(
        editError instanceof WorkflowApiError
          ? editError.message
          : "Something went wrong while updating the workflow. Please try again.",
      )
    } finally {
      requestInFlight.current = false
      if (isMounted.current) {
        dispatch({ type: "async/set", asyncState: { status: "idle" } })
      }
    }
  }

  const handleSubmit = () => {
    if (workflow) {
      void handleIterate()
    } else {
      void handleGenerate()
    }
  }

  const handleSave = async (versionName = "") => {
    if (!editorState || !editorState.present.workflow || !userId || isSaving || requestInFlight.current) return
    const snapshotToSave = editorState.present
    const fingerprintToSave = await fingerprintSnapshot(snapshotToSave)
    setIsSaving(true)
    setError(null)
    setSaveStatus("Saving workflow...")
    try {
      const workflowId = savedWorkflowId ?? await createWorkflowRecord(userId, snapshotToSave)
      const versionNumber = savedWorkflowId ? await saveWorkflowVersion(userId, workflowId, snapshotToSave, versionName) : 1
      if (!savedWorkflowId) setSavedWorkflowId(workflowId)
      setLatestSavedVersionNumber(versionNumber)
      setSavedFingerprint(fingerprintToSave)
      setSaveStatus("Saved")
      setHistoryRefreshKey((value) => value + 1)
    } catch (persistenceError: unknown) {
      setSaveStatus(friendlyPersistenceError(persistenceError))
    } finally {
      setIsSaving(false)
    }
  }

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!editorState || !savedWorkflowId || requestInFlight.current || isSaving || isRestoring) return
    requestInFlight.current = true
    setIsRestoring(true)
    setError(null)
    dispatch({ type: "async/set", asyncState: { status: "loading" } })
    try {
      const currentHash = await fingerprintSnapshot(editorState.present)
      if (currentHash !== savedFingerprint && !window.confirm("This workflow has unsaved changes. Restore this version and discard them?")) return
      const saved = await loadWorkflowVersion(savedWorkflowId, versionNumber)
      if (!saved) throw new Error("The selected saved version could not be found.")
      const snapshot = { workflow: saved.workflow, nodePresentations: saved.nodePresentations, annotations: saved.annotations }
      const restoredFingerprint = await fingerprintSnapshot(snapshot)
      dispatch({ type: "snapshot/record", snapshot })
      dispatch({ type: "selection/set", selection: { kind: "none" } })
      dispatch({ type: "tool/set", tool: "select" })
      setPrompt("")
      setError(null)
      setSaveStatus(`Version ${versionNumber} loaded as an unsaved draft`)
      setRestoredVersion({ versionNumber, fingerprint: restoredFingerprint })
      setHistoryOpen(false)
    } catch {
      setError("We couldn't restore that version. The saved data may be unavailable or invalid. Please retry.")
    } finally {
      requestInFlight.current = false
      setIsRestoring(false)
      dispatch({ type: "async/set", asyncState: { status: "idle" } })
    }
  }

  const confirmDiscardIfDirty = async () => {
    if (!editorState?.present.workflow) return true
    const fingerprint = await fingerprintSnapshot(editorState.present)
    if (fingerprint === savedFingerprint) return true
    return window.confirm("This workflow has unsaved changes. Leave without saving them?")
  }

  const handleBackToLibrary = async () => {
    if (requestInFlight.current || isSaving || editorState?.asyncState.status === "loading") return
    if (!(await confirmDiscardIfDirty())) return
    onBackToLibrary?.()
  }

  const handleReset = async () => {
    if (requestInFlight.current || isSaving || editorState?.asyncState.status === "loading") return
    if (!(await confirmDiscardIfDirty())) return
    dispatch({ type: "workflow/reset" })
    setSavedWorkflowId(null)
    setSavedFingerprint(null)
    setSaveStatus(null)
    setPrompt("")
    setError(null)
  }

  const handlePromptChange = (value: string) => {
    if (requestInFlight.current) return
    setPrompt(value)
    if (error) setError(null)
  }

  const handleUseExample = () => {
    if (requestInFlight.current || workflow) return
    setPrompt(EXAMPLE_PROMPT)
    setError(null)
  }

  return (
    <main className="editor-shell" data-testid="editor-shell">
      <WorkflowEditorCanvas ref={canvasRef} editingViewport={editingViewport} />
      <EditorHeader
        workflowTitle={workflow?.title ?? null}
        hasExportableContent={hasExportableContent}
        isRequestLoading={isRequestLoading}
        onNewWorkflow={() => void handleReset()}
        onBackToLibrary={onBackToLibrary ? () => void handleBackToLibrary() : undefined}
        onVersionHistory={savedWorkflowId ? () => setHistoryOpen(true) : undefined}
        onExport={handleExport}
        onSave={userId && workflow ? handleSave : undefined}
        onSaveVersion={userId && workflow ? (name) => void handleSave(name) : undefined}
        canSave={canSave}
        isSaving={isSaving}
        saveStatus={saveStatus}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />
      {historyOpen && savedWorkflowId && latestSavedVersionNumber !== null && <VersionHistoryDrawer
        workflowId={savedWorkflowId}
        latestVersionNumber={latestSavedVersionNumber}
        currentFingerprint={currentFingerprint}
        savedFingerprint={savedFingerprint}
        restoredVersion={restoredVersion}
        refreshKey={historyRefreshKey}
        isRestoring={isRestoring}
        onClose={() => setHistoryOpen(false)}
        onRestore={(versionNumber) => void handleRestoreVersion(versionNumber)}
      />}
      <EditorToolbar
        editingViewport={editingViewport}
        isRequestLoading={isRequestLoading}
      />
      <ValidationIndicator />
      <InspectorPanel editingViewport={editingViewport} />
      <WorkflowPromptComposer
        mode={workflow ? "iterate" : "generate"}
        value={prompt}
        isLoading={isRequestLoading}
        error={error}
        onChange={handlePromptChange}
        onGenerate={handleSubmit}
        onClear={handleReset}
        onUseExample={handleUseExample}
      />
      <p className="editor-responsive-notice">
        Manual editing is available on larger screens. AI editing and canvas navigation remain available here.
      </p>
    </main>
  )
}

export default EditorShell
