import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/verify", () => ({
  verifyPublications: vi.fn(),
}))

import { verifyPublications } from "@/lib/verify"
import { POST } from "./route"

beforeEach(() => {
  vi.mocked(verifyPublications).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/verify", () => {
  it("llama a verifyPublications con el rango pedido", async () => {
    vi.mocked(verifyPublications).mockResolvedValue({ checked: 2, driftCount: 1, drifts: [] })

    const req = new Request("http://localhost/api/verify", {
      method: "POST",
      body: JSON.stringify({ from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.driftCount).toBe(1)
    expect(verifyPublications).toHaveBeenCalledWith({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T00:00:00.000Z"),
      network: undefined,
    })
  })

  it("rechaza sin from/to", async () => {
    const req = new Request("http://localhost/api/verify", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(verifyPublications).not.toHaveBeenCalled()
  })
})
