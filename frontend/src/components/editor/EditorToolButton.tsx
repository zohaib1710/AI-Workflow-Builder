import type { ButtonHTMLAttributes, ReactNode } from "react"

export interface EditorToolButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string
  icon: ReactNode
  pressed?: boolean
}

function EditorToolButton({ label, icon, pressed, ...buttonProps }: EditorToolButtonProps) {
  return (
    <button
      type="button"
      className="editor-tool-button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      {...buttonProps}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}

export default EditorToolButton
