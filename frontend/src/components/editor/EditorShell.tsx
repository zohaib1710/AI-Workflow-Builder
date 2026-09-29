import { useCallback, useEffect, useRef, useState } from "react"
import { editWorkflow, generateWorkflow, WorkflowApiError } from "../../api/client"
import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import { reconcileWorkflowPresentation } from "../../editor/reconcileWorkflow"
import { createInitialEditorState } from "../../editor/editorReducer"
import { createWorkflowRecord, saveWorkflowVersion } from "../../editor/workflowRepository"
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

export interface EditorShellProps {
  userId?: string
  userEmail?: string | null
  onSignOut?: () => Promise<void>
}

const IDENTITY_INSTABILITY_MESSAGE = "The revised workflow could not preserve the current canvas layout. Try a more specific edit."

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

function EditorShell({ userId, userEmail, onSignOut }: EditorShellProps) {
  const editorState = useEditorState()
  const dispatch = useEditorDispatch()
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedWorkflowId, setSavedWorkflowId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const requestInFlight = useRef(false)
  const isMounted = useRef(true)
  const canvasRef = useRef<WorkflowEditorCanvasHandle | null>(null)
  const editingViewport = useEditingViewport()
  const workflow = editorState?.present.workflow ?? null
  const isEditing = editorState?.asyncState.status === "loading"
  const isRequestLoading = isGenerating || isEditing
  const hasExportableContent = Boolean(workflow && (workflow.nodes.length > 0 || editorState?.present.annotations.length))

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
      const response = await generateWorkflow({ prompt: normalizedPrompt })
      if (!isMounted.current) return
      dispatch({ type: "workflow/adopt", workflow: response.workflow })
      if (userId) {
        try {
          const initialSnapshot = createInitialEditorState(response.workflow).present
          const workflowId = await createWorkflowRecord(userId, initialSnapshot)
          if (isMounted.current) setSavedWorkflowId(workflowId)
        } catch (persistenceError: unknown) {
          if (isMounted.current) setSaveStatus("Initial save failed: " + (persistenceError instanceof Error ? persistenceError.message : "unknown database error"))
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
      const response = await editWorkflow({
        instruction: normalizedInstruction,
        workflow: previous.workflow,
      })
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

  const handleSave = async () => {
    if (!editorState || !editorState.present.workflow || !userId || isSaving) return
    setIsSaving(true)
    setError(null)
    setSaveStatus("Saving workflow...")
    try {
      const workflowId = savedWorkflowId ?? await createWorkflowRecord(userId, editorState.present)
      if (!savedWorkflowId) setSavedWorkflowId(workflowId)
      else await saveWorkflowVersion(userId, workflowId, editorState.present)
      setSaveStatus("Saved")
    } catch (persistenceError: unknown) {
      setSaveStatus("Save failed: " + (persistenceError instanceof Error ? persistenceError.message : "unknown database error"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (requestInFlight.current || editorState?.asyncState.status === "loading") return
    if (editorState && window.confirm("Discard this workflow and start a new one?") === false) return
    dispatch({ type: "workflow/reset" })
    setSavedWorkflowId(null)
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
        onNewWorkflow={handleReset}
        onExport={handleExport}
        onSave={userId && workflow ? handleSave : undefined}
        isSaving={isSaving}
        saveStatus={saveStatus}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />
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
