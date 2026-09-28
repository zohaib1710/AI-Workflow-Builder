import type { SVGProps } from "react"

export type EditorIconName = "brand" | "select" | "shape" | "text" | "undo" | "redo" | "plus"

function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: EditorIconName }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...props }
  switch (name) {
    case "brand": return <svg {...common}><path d="M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z" /></svg>
    case "select": return <svg {...common}><path d="m5 3 13 9-6 1 3 6-2 1-3-6-4 4Z" /></svg>
    case "shape": return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12h8M12 8v8" /></svg>
    case "text": return <svg {...common}><path d="M5 5h14M12 5v14M8 19h8" /></svg>
    case "undo": return <svg {...common}><path d="M9 8 4 12l5 4" /><path d="M4 12h9a6 6 0 0 1 6 6" /></svg>
    case "redo": return <svg {...common}><path d="m15 8 5 4-5 4" /><path d="M20 12h-9a6 6 0 0 0-6 6" /></svg>
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
  }
}

export default Icon
