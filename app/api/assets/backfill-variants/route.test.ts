import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/assets", () => ({
  backfillMissingVariants: vi.fn(),
}))

import { backfillMissingVariants } from "@/lib/assets"
import { POST } from "./route"

beforeEach(() => {
  vi.mocked(backfillMissingVariants).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/assets/backfill-variants", () => {
  it("llama a backfillMissingVariants sin límite por defecto", async () => {
    vi.mocked(backfillMissingVariants).mockResolvedValue({
      totalMissing: 0,
      processed: 0,
      remaining: 0,
      updated: [],
    })

    const req = new Request("http://localhost/api/assets/backfill-variants", { method: "POST" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.remaining).toBe(0)
    expect(backfillMissingVariants).toHaveBeenCalledWith(undefined)
  })

  it("pasa ?limit= como número", async () => {
    vi.mocked(backfillMissingVariants).mockResolvedValue({
      totalMissing: 50,
      processed: 5,
      remaining: 45,
      updated: [],
    })

    const req = new Request("http://localhost/api/assets/backfill-variants?limit=5", { method: "POST" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.remaining).toBe(45)
    expect(backfillMissingVariants).toHaveBeenCalledWith(5)
  })

  it("rechaza un limit inválido sin llamar a backfillMissingVariants", async () => {
    const req = new Request("http://localhost/api/assets/backfill-variants?limit=0", { method: "POST" })
    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(backfillMissingVariants).not.toHaveBeenCalled()
  })

  it("rechaza un limit no numérico", async () => {
    const req = new Request("http://localhost/api/assets/backfill-variants?limit=abc", { method: "POST" })
    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(backfillMissingVariants).not.toHaveBeenCalled()
  })
})
