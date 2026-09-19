import type { Node, NodeProps, NodeTypes } from "@xyflow/react"

export interface AnnotationNodeData extends Record<string, unknown> {
  text: string
}

export type AnnotationFlowNode = Node<AnnotationNodeData, "annotation">

function AnnotationNode({ data, selected }: NodeProps<AnnotationFlowNode>) {
  return (
    <div
      className={`annotation-node${selected ? " annotation-node--selected" : ""}`}
      role="note"
      aria-label={`Annotation: ${data.text}`}
    >
      {data.text}
    </div>
  )
}

export const annotationNodeTypes = { annotation: AnnotationNode } satisfies NodeTypes

export default AnnotationNode
