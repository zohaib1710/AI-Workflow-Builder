import { useEffect, useState } from "react"
import { PROMPT_MAX_LENGTH } from "../../lib/constants"

export type ComposerMode = "generate" | "iterate"

interface WorkflowPromptComposerProps {
  mode: ComposerMode
  value: string
  isLoading: boolean
  error: string | null
  onChange: (value: string) => void
  onGenerate: () => void
  onClear: () => void
  onUseExample: () => void
}

function WorkflowPromptComposer({
  mode,
  value,
  isLoading,
  error,
  onChange,
  onGenerate,
  onClear,
  onUseExample,
}: WorkflowPromptComposerProps) {
  const isIteration = mode === "iterate"
  const [isCollapsed, setIsCollapsed] = useState(false)
  const normalizedLength = value.trim().length
  const isOverLimit = normalizedLength > PROMPT_MAX_LENGTH
  const isSubmitDisabled = isLoading || normalizedLength === 0 || isOverLimit
  const heading = isIteration ? "Refine this workflow" : "Describe your workflow"
  const placeholder = isIteration
    ? "Ask AI to modify this workflow..."
    : "Describe the workflow you want to create..."

  useEffect(() => {
    setIsCollapsed(false)
  }, [mode])

  if (isIteration && isCollapsed) {
    return (
      <section className="editor-composer editor-composer--iterate editor-composer--collapsed" data-composer-mode={mode}>
        <h2 className="editor-composer__heading">Refine this workflow</h2>
        <button type="button" className="editor-composer__collapse" onClick={() => setIsCollapsed(false)}>
          Expand AI prompt
        </button>
      </section>
    )
  }

  return (
    <section className={`editor-composer editor-composer--${mode}`} data-composer-mode={mode}>
      <div className="editor-composer__heading-row">
        <div>
          <h2 id="workflow-composer-heading" className="editor-composer__heading">{heading}</h2>
          {!isIteration && (
            <p className="editor-composer__intro">
              Include the trigger, key actions, decisions, and desired outcome.
            </p>
          )}
        </div>
        {isIteration && (
          <button type="button" className="editor-composer__collapse" onClick={() => setIsCollapsed(true)} disabled={isLoading}>
            Collapse
          </button>
        )}
        {!isIteration && (
          <button type="button" onClick={onUseExample} disabled={isLoading} className="editor-composer__example">
            Use example prompt
          </button>
        )}
      </div>

      <form
        aria-labelledby="workflow-composer-heading"
        aria-busy={isLoading}
        onSubmit={(event) => {
          event.preventDefault()
          if (!isSubmitDisabled) onGenerate()
        }}
        className="editor-composer__form"
      >
        <label htmlFor="workflow-prompt" className="editor-composer__label">Workflow prompt</label>
        <textarea
          id="workflow-prompt"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={PROMPT_MAX_LENGTH}
          rows={isIteration ? 2 : 5}
          placeholder={placeholder}
          aria-describedby={isIteration ? "iteration-guidance prompt-count" : "prompt-guidance prompt-count"}
          aria-invalid={isOverLimit}
          disabled={isLoading}
          className="editor-composer__textarea"
        />
        <p id="prompt-guidance" className="sr-only">Enter no more than 2,000 characters.</p>
        {isIteration && (
          <p id="iteration-guidance" className="editor-composer__guidance">
            Describe the change you want AI to make to this workflow.
          </p>
        )}
        <p id="prompt-count" className={`prompt-count${isOverLimit ? " prompt-count--warning" : ""}`}>
          {value.length} / {PROMPT_MAX_LENGTH}
        </p>

        {error && <p role="alert" className="editor-composer__error">{error}</p>}
        {isLoading && (
          <p role="status" aria-live="polite" className="prompt-loading-status">
            {isIteration ? "Updating workflow..." : "Generating workflow..."}
          </p>
        )}

        <div className="editor-composer__actions">
          {!isIteration && (
            <button type="button" onClick={onClear} disabled={isLoading} className="editor-button editor-button--secondary">
              Clear
            </button>
          )}
          <button type="submit" disabled={isSubmitDisabled} className="editor-button editor-button--primary">
            {isLoading ? (isIteration ? "Updating workflow..." : "Generating workflow...") : isIteration ? "Update workflow" : "Generate workflow"}
          </button>
        </div>
      </form>
    </section>
  )
}

export default WorkflowPromptComposer
