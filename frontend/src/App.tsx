import { useState } from "react"
import Header from "./components/Header"
import PromptPanel from "./components/PromptPanel"
import { generateWorkflow, WorkflowApiError } from "./api/client"
import { EXAMPLE_PROMPT, PROMPT_MAX_LENGTH } from "./lib/constants"
import type { GenerateWorkflowResponse } from "./types/workflow"

function App() {
  const [prompt, setPrompt] = useState("")
  const [result, setResult] = useState<GenerateWorkflowResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt || normalizedPrompt.length > PROMPT_MAX_LENGTH || isLoading) {
      setError("Enter a workflow prompt within the character limit.")
      return
    }

    setError(null)
    setIsLoading(true)
    try {
      const response = await generateWorkflow({ prompt: normalizedPrompt })
      setResult(response)
      setError(null)
    } catch (generationError: unknown) {
      setError(
        generationError instanceof WorkflowApiError
          ? generationError.message
          : "Workflow generation failed. Please try again.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    if (isLoading) return
    setPrompt("")
    setResult(null)
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
          onChange={(value) => { setPrompt(value); if (error) setError(null) }}
          onGenerate={handleGenerate}
          onClear={handleClear}
          onUseExample={() => { setPrompt(EXAMPLE_PROMPT); setError(null) }}
        />
        <section aria-label="Workflow result" className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
          {result ? "Workflow generated successfully. The visual workflow will appear here." : "Your generated workflow will appear here."}
        </section>
      </div>
    </main>
  )
}

export default App
