import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/db/queries/photographers", () => ({
  listPhotographers: vi.fn(),
  createPhotographer: vi.fn(),
}))

import { createPhotographer, listPhotographers } from "@/db/queries/photographers"
import { GET, POST } from "./route"

beforeEach(() => {
  vi.mocked(listPhotographers).mockReset()
  vi.mocked(createPhotographer).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GET /api/photographers", () => {
  it("devuelve el catálogo envuelto en { data }", async () => {
    vi.mocked(listPhotographers).mockResolvedValue([
      { id: "p1", name: "Ana Foto", instagramHandle: null, createdAt: new Date() },
    ] as never)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })
})

describe("POST /api/photographers", () => {
  it("crea un fotógrafo con un payload válido", async () => {
    vi.mocked(createPhotographer).mockResolvedValue({
      id: "p1",
      name: "Ana Foto",
      instagramHandle: null,
      createdAt: new Date(),
    } as never)

    const req = new Request("http://localhost/api/photographers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana Foto" }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.name).toBe("Ana Foto")
  })

  it("rechaza un payload vacío con 400", async () => {
    const req = new Request("http://localhost/api/photographers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(createPhotographer).not.toHaveBeenCalled()
  })
})
