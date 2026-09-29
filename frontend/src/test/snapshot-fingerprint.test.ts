import { describe, expect, it } from "vitest"
import { fingerprintSnapshot, persistedSnapshotPayload } from "../editor/snapshotFingerprint"
import type { EditorSnapshot } from "../editor/types"

const snapshot = (title = "Workflow"): EditorSnapshot => ({
  workflow: { title, description: "Description", nodes: [], edges: [] },
  nodePresentations: {},
  annotations: [],
})

describe("snapshot fingerprints", () => {
  it("ignores object key order and excludes transient editor state", async () => {
    const first = snapshot()
    const second = { ...snapshot(), workflow: { edges: [], nodes: [], description: "Description", title: "Workflow" } }
    expect(persistedSnapshotPayload(first)).toBe(persistedSnapshotPayload(second))
    expect(await fingerprintSnapshot(first)).toBe(await fingerprintSnapshot(second))
  })

  it("changes when persisted workflow content changes", async () => {
    expect(await fingerprintSnapshot(snapshot())).not.toBe(await fingerprintSnapshot(snapshot("Changed")))
  })
})
