import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/assets", () => ({
  getAssetWithUsages: vi.fn(),
}))
vi.mock("@/db/queries/assets", () => ({
  updateAsset: vi.fn(),
  archiveAsset: vi.fn(),
}))

import { archiveAsset, updateAsset } from "@/db/queries/assets"
import { getAssetWithUsages } from "@/lib/assets"
import { DELETE, GET, PATCH } from "./route"

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.mocked(getAssetWithUsages).mockReset()
  vi.mocked(updateAsset).mockReset()
  vi.mocked(archiveAsset).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GET /api/assets/:id", () => {
  it("devuelve el asset con su historial de uso", async () => {
    vi.mocked(getAssetWithUsages).mockResolvedValue({ id: "a1", usages: [] } as never)

    const res = await GET(new NextRequest("http://localhost/api/assets/a1"), ctxFor("a1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe("a1")
  })

  it("devuelve 404 si no existe", async () => {
    vi.mocked(getAssetWithUsages).mockResolvedValue(undefined)

    const res = await GET(new NextRequest("http://localhost/api/assets/nope"), ctxFor("nope"))

    expect(res.status).toBe(404)
  })
})

describe("PATCH /api/assets/:id", () => {
  it("actualiza metadata con un payload válido", async () => {
    vi.mocked(updateAsset).mockResolvedValue({ id: "a1", shortDescription: "nueva" } as never)

    const req = new NextRequest("http://localhost/api/assets/a1", {
      method: "PATCH",
      body: JSON.stringify({ shortDescription: "nueva" }),
    })
    const res = await PATCH(req, ctxFor("a1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.shortDescription).toBe("nueva")
    expect(updateAsset).toHaveBeenCalledWith("a1", { shortDescription: "nueva" })
  })

  it("rechaza un productUrl que no es una URL válida", async () => {
    const req = new NextRequest("http://localhost/api/assets/a1", {
      method: "PATCH",
      body: JSON.stringify({ productUrl: "no-es-url" }),
    })
    const res = await PATCH(req, ctxFor("a1"))

    expect(res.status).toBe(400)
    expect(updateAsset).not.toHaveBeenCalled()
  })

  it("devuelve 404 si el asset no existe", async () => {
    vi.mocked(updateAsset).mockResolvedValue(undefined)

    const req = new NextRequest("http://localhost/api/assets/nope", {
      method: "PATCH",
      body: JSON.stringify({ shortDescription: "nueva" }),
    })
    const res = await PATCH(req, ctxFor("nope"))

    expect(res.status).toBe(404)
  })
})

describe("DELETE /api/assets/:id", () => {
  it("archiva en vez de borrar", async () => {
    vi.mocked(archiveAsset).mockResolvedValue({ id: "a1", status: "ARCHIVED" } as never)

    const res = await DELETE(new NextRequest("http://localhost/api/assets/a1"), ctxFor("a1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.status).toBe("ARCHIVED")
  })

  it("devuelve 404 si el asset no existe", async () => {
    vi.mocked(archiveAsset).mockResolvedValue(undefined)

    const res = await DELETE(new NextRequest("http://localhost/api/assets/nope"), ctxFor("nope"))

    expect(res.status).toBe(404)
  })
})
