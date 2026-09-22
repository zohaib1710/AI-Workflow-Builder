import type { FlowchartShape } from "../../../editor/types"
import { memo } from "react"

export interface ShapeGeometryProps {
  shape: FlowchartShape
}

const ShapeGeometry = memo(function ShapeGeometry({ shape }: ShapeGeometryProps) {
  const geometry = (() => {
    switch (shape) {
      case "terminator":
        return <rect x="8" y="22" width="224" height="96" rx="48" />
      case "process":
        return <rect x="8" y="10" width="224" height="120" rx="3" />
      case "decision":
        return <polygon points="120,4 232,70 120,136 8,70" />
      case "input-output":
        return <polygon points="34,10 232,10 206,130 8,130" />
      case "database":
        return <><path d="M20 27C20 15 64 6 120 6s100 9 100 21v86c0 12-44 21-100 21s-100-9-100-21Z" /><path className="flowchart-node__geometry-detail" d="M20 27c0 12 44 21 100 21s100-9 100-21M20 109c0 12 44 21 100 21s100-9 100-21" /></>
      case "document":
        return <path d="M8 8h224v103c-34-14-54 22-89 9-38-14-62 13-95 1-15-5-26-10-40-5Z" />
      case "delay":
        return <path d="M8 10h154a60 60 0 0 1 0 120H8Z" />
      case "predefined-process":
        return <><rect x="8" y="10" width="224" height="120" rx="3" /><path className="flowchart-node__geometry-detail" d="M32 10v120M208 10v120" /></>
      case "manual-operation":
        return <polygon points="8,10 232,10 204,130 36,130" />
    }
  })()

  return (
    <svg className="flowchart-node__geometry" data-shape-geometry={shape} viewBox="0 0 240 140" aria-hidden="true" focusable="false">
      {geometry}
    </svg>
  )
})

export default ShapeGeometry
