import { PROMPT_MAX_LENGTH } from "../lib/constants"

interface PromptPanelProps {
  value: string
  isLoading: boolean
  error: string | null
  onChange: (value: string) => void
  onGenerate: () => void
  onClear: () => void
  onUseExample: () => void
}

function PromptPanel({
  value,
  isLoading,
  error,
  onChange,
  onGenerate,
  onClear,
  onUseExample,
}: PromptPanelProps) {
  const isGenerateDisabled = isLoading || value.trim().length === 0 || value.length > PROMPT_MAX_LENGTH

  return (
    <section aria-labelledby="prompt-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="prompt-heading" className="text-xl font-semibold text-slate-950">Describe your workflow</h2>
          <p className="mt-1 text-sm text-slate-500">Include the trigger, key actions, decisions, and desired outcome.</p>
        </div>
        <button type="button" onClick={onUseExample} disabled={isLoading} className="self-start text-sm font-medium text-cyan-700 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">
          Use example prompt
        </button>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); if (!isGenerateDisabled) onGenerate() }} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="workflow-prompt" className="text-sm font-semibold text-slate-800">Workflow prompt</label>
          <textarea
            id="workflow-prompt"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={PROMPT_MAX_LENGTH}
            rows={7}
            placeholder="For example: Create a workflow that qualifies new leads and routes them to the right sales representative."
            aria-describedby="prompt-count"
            aria-busy={isLoading}
            className="block w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          />
          <p id="prompt-count" className="text-right text-sm text-slate-500">{value.length} / {PROMPT_MAX_LENGTH}</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClear} disabled={isLoading} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Clear</button>
          <button type="submit" disabled={isGenerateDisabled} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-300">
            {isLoading ? "Generating workflow…" : "Generate Workflow"}
          </button>
        </div>
      </form>
    </section>
  )
}

export default PromptPanel
