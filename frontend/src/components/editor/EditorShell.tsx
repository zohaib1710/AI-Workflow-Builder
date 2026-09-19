import { useEffect, useRef, useState } from "react"
import { generateWorkflow, WorkflowApiError } from "../../api/client"
import { useEditorDispatch, useEditorState } from "../../editor/EditorContext"
import { EXAMPLE_PROMPT, PROMPT_MAX_LENGTH } from "../../lib/constants"
import EditorHeader from "./EditorHeader"
import EditorToolbar from "./EditorToolbar"
import InspectorPanel from "./InspectorPanel"
import ValidationIndicator from "./ValidationIndicator"
import WorkflowEditorCanvas from "./WorkflowEditorCanvas"
import WorkflowPromptComposer from "./WorkflowPromptComposer"

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

function EditorShell() {
  const editorState = useEditorState()
  const dispatch = useEditorDispatch()
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestInFlight = useRef(false)
  const isMounted = useRef(true)
  const editingViewport = useEditingViewport()
  const workflow = editorState?.present.workflow ?? null

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
      setError("The workflow prompt must be 5,000 characters or fewer.")
      return
    }

    requestInFlight.current = true
    setError(null)
    setIsLoading(true)
    try {
      const response = await generateWorkflow({ prompt: normalizedPrompt })
      if (!isMounted.current) return
      dispatch({ type: "workflow/adopt", workflow: response.workflow })
      setPrompt("")
      setError(null)
    } catch (generationError: unknown) {
      if (!isMounted.current) return
      setError(
        generationError instanceof WorkflowApiError
          ? generationError.message
          : "Something went wrong while generating the workflow. Please try again.",
      )
    } finally {
      requestInFlight.current = false
      if (isMounted.current) setIsLoading(false)
    }
  }

  const handleReset = () => {
    if (requestInFlight.current || editorState?.asyncState.status === "loading") return
    if (editorState && window.confirm("Discard this workflow and start a new one?") === false) return
    dispatch({ type: "workflow/reset" })
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
      <WorkflowEditorCanvas editingViewport={editingViewport} />
      <EditorHeader workflowTitle={workflow?.title ?? null} onNewWorkflow={handleReset} />
      <EditorToolbar editingViewport={editingViewport} onNewWorkflow={handleReset} />
      <ValidationIndicator />
      <InspectorPanel editingViewport={editingViewport} />
      <WorkflowPromptComposer
        mode={workflow ? "iterate" : "generate"}
        value={prompt}
        isLoading={isLoading}
        error={error}
        onChange={handlePromptChange}
        onGenerate={handleGenerate}
        onClear={handleReset}
        onUseExample={handleUseExample}
      />
      <p className="editor-responsive-notice">
        Workflow editing is optimized for tablet and desktop screens.
      </p>
    </main>
  )
}

export default EditorShell
