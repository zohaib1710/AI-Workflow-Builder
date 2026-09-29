import type { EditorSnapshot } from "./types"

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize(entry)]))
  }
  return value
}

export function persistedSnapshotPayload(snapshot: EditorSnapshot): string {
  return JSON.stringify(canonicalize({ workflow: snapshot.workflow, nodePresentations: snapshot.nodePresentations, annotations: snapshot.annotations }))
}

export async function fingerprintSnapshot(snapshot: EditorSnapshot): Promise<string> {
  const bytes = new TextEncoder().encode(persistedSnapshotPayload(snapshot))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
