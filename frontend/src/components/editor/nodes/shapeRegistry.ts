import type { FlowchartShape } from "../../../editor/types"

export interface FlowchartShapeDefinition {
  label: string
  width: number
  height: number
  contentClassName: string
}

export const FLOWCHART_SHAPES = {
  terminator: { label: "Terminator", width: 228, height: 112, contentClassName: "flowchart-node__content--terminator" },
  process: { label: "Process", width: 244, height: 128, contentClassName: "flowchart-node__content--process" },
  decision: { label: "Decision", width: 210, height: 160, contentClassName: "flowchart-node__content--decision" },
  "input-output": { label: "Input / output", width: 244, height: 128, contentClassName: "flowchart-node__content--input-output" },
  database: { label: "Database", width: 224, height: 146, contentClassName: "flowchart-node__content--database" },
  document: { label: "Document", width: 244, height: 140, contentClassName: "flowchart-node__content--document" },
  delay: { label: "Delay", width: 232, height: 128, contentClassName: "flowchart-node__content--delay" },
  "predefined-process": { label: "Predefined process", width: 244, height: 128, contentClassName: "flowchart-node__content--predefined-process" },
  "manual-operation": { label: "Manual operation", width: 244, height: 128, contentClassName: "flowchart-node__content--manual-operation" },
} as const satisfies Record<FlowchartShape, FlowchartShapeDefinition>

export const flowchartShapeNames = Object.keys(FLOWCHART_SHAPES) as FlowchartShape[]

export function isFlowchartShape(value: string): value is FlowchartShape {
  return Object.prototype.hasOwnProperty.call(FLOWCHART_SHAPES, value)
}
