import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/publications", () => ({
  createStoryForPublication: vi.fn(),
}))

import { createStoryForPublication } from "@/lib/publications"
import { POST } from "./route"

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.mocked(createStoryForPublication).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/publications/:id/story", () => {
  it("crea la story asociada con un payload válido", async () => {
    vi.mocked(createStoryForPublication).mockResolvedValue({ id: "story-1", format: "STORY" } as never)

    const req = new NextRequest("http://localhost/api/publications/pub-1/story", {
      method: "POST",
      body: JSON.stringify({ publicationDate: "2026-09-10T10:00:00.000Z" }),
    })
    const res = await POST(req, ctxFor("pub-1"))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.id).toBe("story-1")
    expect(createStoryForPublication).toHaveBeenCalledWith("pub-1", {
      publicationDate: new Date("2026-09-10T10:00:00.000Z"),
      text: undefined,
      assetIds: undefined,
    })
  })

  it("rechaza sin publicationDate", async () => {
    const req = new NextRequest("http://localhost/api/publications/pub-1/story", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req, ctxFor("pub-1"))

    expect(res.status).toBe(400)
    expect(createStoryForPublication).not.toHaveBeenCalled()
  })

  it("devuelve 400 cuando la publicación origen no existe", async () => {
    vi.mocked(createStoryForPublication).mockRejectedValue(new Error("Publication pub-1 no encontrada."))

    const req = new NextRequest("http://localhost/api/publications/pub-1/story", {
      method: "POST",
      body: JSON.stringify({ publicationDate: "2026-09-10T10:00:00.000Z" }),
    })
    const res = await POST(req, ctxFor("pub-1"))

    expect(res.status).toBe(400)
  })
})
