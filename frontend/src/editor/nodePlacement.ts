import { FLOWCHART_SHAPES } from "../components/editor/nodes/shapeRegistry"
import type { CanvasAnnotation, CanvasNodePresentation, CanvasPosition, FlowchartShape } from "./types"

const COLLISION_GAP = 28
const SEARCH_STEP = 32
const SEARCH_RINGS = 80
const ANNOTATION_WIDTH = 160
const ANNOTATION_HEIGHT = 64

interface OccupiedRectangle {
  position: CanvasPosition
  width: number
  height: number
}

function rectanglesOverlap(
  position: CanvasPosition,
  width: number,
  height: number,
  occupied: OccupiedRectangle,
): boolean {
  return position.x < occupied.position.x + occupied.width + COLLISION_GAP
    && position.x + width + COLLISION_GAP > occupied.position.x
    && position.y < occupied.position.y + occupied.height + COLLISION_GAP
    && position.y + height + COLLISION_GAP > occupied.position.y
}

function overlaps(
  position: CanvasPosition,
  shape: FlowchartShape,
  occupied: CanvasNodePresentation,
): boolean {
  const moving = FLOWCHART_SHAPES[shape]
  const fixed = FLOWCHART_SHAPES[occupied.shape]
  return rectanglesOverlap(position, moving.width, moving.height, {
    position: occupied.position,
    width: fixed.width,
    height: fixed.height,
  })
}

function isClear(
  position: CanvasPosition,
  shape: FlowchartShape,
  occupied: readonly CanvasNodePresentation[],
): boolean {
  return occupied.every((candidate) => !overlaps(position, shape, candidate))
}

export function findNearestClearNodePosition(
  desired: CanvasPosition,
  shape: FlowchartShape,
  presentations: Readonly<Record<string, CanvasNodePresentation>>,
  excludedNodeId?: string,
): CanvasPosition {
  const occupied = Object.values(presentations).filter(
    (presentation) => presentation.nodeId !== excludedNodeId,
  )
  if (isClear(desired, shape, occupied)) return { ...desired }

  for (let ring = 1; ring <= SEARCH_RINGS; ring += 1) {
    const distance = ring * SEARCH_STEP
    const candidates = [
      { x: desired.x + distance, y: desired.y },
      { x: desired.x, y: desired.y + distance },
      { x: desired.x - distance, y: desired.y },
      { x: desired.x, y: desired.y - distance },
      { x: desired.x + distance, y: desired.y + distance },
      { x: desired.x - distance, y: desired.y + distance },
      { x: desired.x + distance, y: desired.y - distance },
      { x: desired.x - distance, y: desired.y - distance },
    ]
    const clear = candidates.find((candidate) => isClear(candidate, shape, occupied))
    if (clear) return clear
  }

  const lowestEdge = occupied.reduce((bottom, candidate) => (
    Math.max(bottom, candidate.position.y + FLOWCHART_SHAPES[candidate.shape].height)
  ), desired.y)
  return { x: desired.x, y: lowestEdge + COLLISION_GAP }
}

export function separateNodePresentations(
  presentations: Readonly<Record<string, CanvasNodePresentation>>,
  nodeOrder: readonly string[],
): Record<string, CanvasNodePresentation> {
  const separated: Record<string, CanvasNodePresentation> = {}
  for (const nodeId of nodeOrder) {
    const presentation = presentations[nodeId]
    if (!presentation) continue
    separated[nodeId] = {
      ...presentation,
      position: findNearestClearNodePosition(
        presentation.position,
        presentation.shape,
        separated,
      ),
    }
  }
  return separated
}

export function findNearestClearAnnotationPosition(
  desired: CanvasPosition,
  presentations: Readonly<Record<string, CanvasNodePresentation>>,
  annotations: readonly CanvasAnnotation[],
): CanvasPosition {
  const occupied: OccupiedRectangle[] = [
    ...Object.values(presentations).map((presentation) => {
      const shape = FLOWCHART_SHAPES[presentation.shape]
      return { position: presentation.position, width: shape.width, height: shape.height }
    }),
    ...annotations.map((annotation) => ({
      position: annotation.position,
      width: ANNOTATION_WIDTH,
      height: ANNOTATION_HEIGHT,
    })),
  ]
  const isClear = (position: CanvasPosition) => occupied.every(
    (candidate) => !rectanglesOverlap(position, ANNOTATION_WIDTH, ANNOTATION_HEIGHT, candidate),
  )
  if (isClear(desired)) return { ...desired }

  for (let ring = 1; ring <= SEARCH_RINGS; ring += 1) {
    const distance = ring * SEARCH_STEP
    const candidates = [
      { x: desired.x + distance, y: desired.y },
      { x: desired.x, y: desired.y + distance },
      { x: desired.x - distance, y: desired.y },
      { x: desired.x, y: desired.y - distance },
      { x: desired.x + distance, y: desired.y + distance },
      { x: desired.x - distance, y: desired.y + distance },
      { x: desired.x + distance, y: desired.y - distance },
      { x: desired.x - distance, y: desired.y - distance },
    ]
    const clear = candidates.find(isClear)
    if (clear) return clear
  }

  const lowestEdge = occupied.reduce(
    (bottom, candidate) => Math.max(bottom, candidate.position.y + candidate.height),
    desired.y,
  )
  return { x: desired.x, y: lowestEdge + COLLISION_GAP }
}
