import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/publications", () => ({
  updatePublication: vi.fn(),
  deletePublication: vi.fn(),
}))

import { deletePublication, updatePublication } from "@/lib/publications"
import { DELETE, PATCH } from "./route"

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.mocked(updatePublication).mockReset()
  vi.mocked(deletePublication).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("PATCH /api/publications/:id", () => {
  it("actualiza con un payload válido", async () => {
    vi.mocked(updatePublication).mockResolvedValue({ id: "pub-1", text: "nuevo" } as never)

    const req = new NextRequest("http://localhost/api/publications/pub-1", {
      method: "PATCH",
      body: JSON.stringify({ text: "nuevo" }),
    })
    const res = await PATCH(req, ctxFor("pub-1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.text).toBe("nuevo")
  })

  it("devuelve 404 si no existe", async () => {
    vi.mocked(updatePublication).mockResolvedValue(undefined)

    const req = new NextRequest("http://localhost/api/publications/nope", {
      method: "PATCH",
      body: JSON.stringify({ text: "x" }),
    })
    const res = await PATCH(req, ctxFor("nope"))

    expect(res.status).toBe(404)
  })

  it("devuelve 400 con un publicationDate mal formado", async () => {
    const req = new NextRequest("http://localhost/api/publications/pub-1", {
      method: "PATCH",
      body: JSON.stringify({ publicationDate: "no-es-fecha" }),
    })
    const res = await PATCH(req, ctxFor("pub-1"))

    expect(res.status).toBe(400)
    expect(updatePublication).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/publications/:id", () => {
  it("borra y devuelve true", async () => {
    vi.mocked(deletePublication).mockResolvedValue(true)

    const res = await DELETE(new NextRequest("http://localhost/api/publications/pub-1"), ctxFor("pub-1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toBe(true)
  })

  it("devuelve 404 si no existe", async () => {
    vi.mocked(deletePublication).mockResolvedValue(false)

    const res = await DELETE(new NextRequest("http://localhost/api/publications/nope"), ctxFor("nope"))

    expect(res.status).toBe(404)
  })
})
