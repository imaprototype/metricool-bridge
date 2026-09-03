import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/db/queries/brands", () => ({
  listBrands: vi.fn(),
  createBrand: vi.fn(),
}))

import { createBrand, listBrands } from "@/db/queries/brands"
import { GET, POST } from "./route"

beforeEach(() => {
  vi.mocked(listBrands).mockReset()
  vi.mocked(createBrand).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GET /api/brands", () => {
  it("devuelve el catálogo envuelto en { data }", async () => {
    vi.mocked(listBrands).mockResolvedValue([
      { id: "b1", name: "NØRU", instagramHandle: null, toneNotes: null, targetAudience: null, createdAt: new Date() },
    ] as never)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe("NØRU")
  })
})

describe("POST /api/brands", () => {
  it("crea una marca con un payload válido", async () => {
    vi.mocked(createBrand).mockResolvedValue({
      id: "b1",
      name: "NØRU",
      instagramHandle: "@noru",
      toneNotes: null,
      targetAudience: null,
      createdAt: new Date(),
    } as never)

    const req = new Request("http://localhost/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "NØRU", instagramHandle: "@noru" }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.name).toBe("NØRU")
    expect(createBrand).toHaveBeenCalledWith({ name: "NØRU", instagramHandle: "@noru" })
  })

  it("rechaza un payload sin name con 400", async () => {
    const req = new Request("http://localhost/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramHandle: "@noru" }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(createBrand).not.toHaveBeenCalled()
  })

  it("rechaza un body que no es JSON con 400 (no revienta)", async () => {
    const req = new Request("http://localhost/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "esto no es json",
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
