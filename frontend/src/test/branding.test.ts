import { describe, expect, it } from "vitest"
import html from "../../index.html?raw"

describe("product branding", () => {
  it("sets the browser title, description, and authored SVG favicon", () => {
    expect(html).toContain("<title>Systemapic Workflow Builder</title>")
    expect(html).toContain('name="description" content="Systemapic Workflow Builder')
    expect(html).toContain('href="/favicon.svg"')
  })
})
