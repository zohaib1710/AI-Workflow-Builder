import { useEffect, useRef, useState } from "react"
import Header from "./components/Header"
import PromptPanel from "./components/PromptPanel"
import WorkflowResult from "./components/WorkflowResult"
import { generateWorkflow, WorkflowApiError } from "./api/client"
import { EXAMPLE_PROMPT, PROMPT_MAX_LENGTH } from "./lib/constants"
import type { GenerateWorkflowResponse } from "./types/workflow"

function App() {
  const [prompt, setPrompt] = useState("")
  const [result, setResult] = useState<GenerateWorkflowResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestInFlight = useRef(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const handleGenerate = async () => {
    if (requestInFlight.current) return

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
      setResult(response)
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

  const handleClear = () => {
    if (requestInFlight.current) return
    setPrompt("")
    setResult(null)
    setError(null)
  }

  const handlePromptChange = (value: string) => {
    if (requestInFlight.current) return
    setPrompt(value)
    if (error) setError(null)
  }

  const handleUseExample = () => {
    if (requestInFlight.current) return
    setPrompt(EXAMPLE_PROMPT)
    setError(null)
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <Header />
        <PromptPanel
          value={prompt}
          isLoading={isLoading}
          error={error}
          onChange={handlePromptChange}
          onGenerate={handleGenerate}
          onClear={handleClear}
          onUseExample={handleUseExample}
        />
        {result && <WorkflowResult result={result} />}
      </div>
    </main>
  )
}

export default App
