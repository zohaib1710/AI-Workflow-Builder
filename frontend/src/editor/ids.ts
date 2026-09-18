export type EditorUuidGenerator = () => string

function browserUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`
  }
  throw new Error("Secure editor ID generation is unavailable.")
}

export function createUniqueEditorId(
  prefix: string,
  existingIds: ReadonlySet<string>,
  generateUuid: EditorUuidGenerator = browserUuid,
): string {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const uuid = generateUuid()
    const candidate = prefix ? `${prefix}-${uuid}` : uuid
    if (!existingIds.has(candidate)) return candidate
  }
  throw new Error("Unable to create a unique editor ID.")
}
