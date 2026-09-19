import { useEffect, useState, type KeyboardEvent } from "react"
import { useEditorDispatch } from "../../editor/EditorContext"
import type { CanvasAnnotation } from "../../editor/types"

export interface AnnotationInspectorProps {
  annotation: CanvasAnnotation
  disabled: boolean
}

function AnnotationInspector({ annotation, disabled }: AnnotationInspectorProps) {
  const dispatch = useEditorDispatch()
  const [text, setText] = useState(annotation.text)

  useEffect(() => {
    setText(annotation.text)
  }, [annotation.id, annotation.text])

  const commitText = () => {
    if (disabled) return
    const normalized = text.trim() || "Text"
    setText(normalized)
    dispatch({ type: "annotation/text-commit", annotationId: annotation.id, text: normalized })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) event.currentTarget.blur()
  }

  return (
    <div className="annotation-inspector">
      <label className="node-inspector__field">
        <span>Text</span>
        <textarea value={text} disabled={disabled} onChange={(event) => setText(event.target.value)} onBlur={commitText} onKeyDown={handleKeyDown} />
      </label>
      <button className="node-inspector__delete" type="button" disabled={disabled} onClick={() => dispatch({ type: "annotation/delete", annotationId: annotation.id })}>
        Delete annotation
      </button>
    </div>
  )
}

export default AnnotationInspector
