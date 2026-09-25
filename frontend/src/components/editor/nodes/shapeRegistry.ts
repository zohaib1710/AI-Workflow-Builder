import type { FlowchartShape } from "../../../editor/types"

export interface FlowchartShapeDefinition {
  label: string
  width: number
  height: number
  contentClassName: string
  defaultColor: string
}

export const FLOWCHART_SHAPES = {
  terminator: { label: "Terminator", width: 280, height: 150, contentClassName: "flowchart-node__content--terminator", defaultColor: "#16a34a" },
  process: { label: "Process", width: 270, height: 150, contentClassName: "flowchart-node__content--process", defaultColor: "#2563eb" },
  decision: { label: "Decision", width: 240, height: 180, contentClassName: "flowchart-node__content--decision", defaultColor: "#d97706" },
  "input-output": { label: "Input / output", width: 270, height: 150, contentClassName: "flowchart-node__content--input-output", defaultColor: "#0891b2" },
  database: { label: "Database", width: 260, height: 170, contentClassName: "flowchart-node__content--database", defaultColor: "#7c3aed" },
  document: { label: "Document", width: 270, height: 165, contentClassName: "flowchart-node__content--document", defaultColor: "#4f46e5" },
  delay: { label: "Delay", width: 270, height: 150, contentClassName: "flowchart-node__content--delay", defaultColor: "#ea580c" },
  "predefined-process": { label: "Predefined process", width: 270, height: 150, contentClassName: "flowchart-node__content--predefined-process", defaultColor: "#0d9488" },
  "manual-operation": { label: "Manual operation", width: 270, height: 150, contentClassName: "flowchart-node__content--manual-operation", defaultColor: "#db2777" },
} as const satisfies Record<FlowchartShape, FlowchartShapeDefinition>

export const flowchartShapeNames = Object.keys(FLOWCHART_SHAPES) as FlowchartShape[]

export function isFlowchartShape(value: string): value is FlowchartShape {
  return Object.prototype.hasOwnProperty.call(FLOWCHART_SHAPES, value)
}
