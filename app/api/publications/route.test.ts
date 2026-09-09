import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/publications", () => ({
  createPublication: vi.fn(),
  listPublicationsWithTargets: vi.fn(),
}))

import { createPublication, listPublicationsWithTargets } from "@/lib/publications"
import { GET, POST } from "./route"

const VALID_ASSET_ID = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.mocked(createPublication).mockReset()
  vi.mocked(listPublicationsWithTargets).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GET /api/publications", () => {
  it("traduce from/to/network a filtros tipados", async () => {
    vi.mocked(listPublicationsWithTargets).mockResolvedValue([])

    await GET(new Request("http://localhost/api/publications?from=2026-09-01&to=2026-09-30&network=instagram"))

    expect(listPublicationsWithTargets).toHaveBeenCalledWith({
      from: new Date("2026-09-01"),
      to: new Date("2026-09-30"),
      network: "instagram",
    })
  })
})

describe("POST /api/publications", () => {
  const validBody = {
    format: "FEED_POST",
    assetId: VALID_ASSET_ID,
    text: "hola",
    publicationDate: "2026-09-10T10:00:00.000Z",
    targets: [{ network: "instagram" }],
  }

  it("crea una publicación con un payload válido", async () => {
    vi.mocked(createPublication).mockResolvedValue({ id: "pub-1" } as never)

    const req = new Request("http://localhost/api/publications", {
      method: "POST",
      body: JSON.stringify(validBody),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.id).toBe("pub-1")
    expect(createPublication).toHaveBeenCalledWith(
      expect.objectContaining({ format: "FEED_POST", assetId: VALID_ASSET_ID })
    )
  })

  it("rechaza un formato desconocido", async () => {
    const req = new Request("http://localhost/api/publications", {
      method: "POST",
      body: JSON.stringify({ ...validBody, format: "BOGUS" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(createPublication).not.toHaveBeenCalled()
  })

  it("rechaza si no hay targets", async () => {
    const req = new Request("http://localhost/api/publications", {
      method: "POST",
      body: JSON.stringify({ ...validBody, targets: [] }),
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it("devuelve 400 (no 500) cuando la lógica de negocio lanza un error de dominio", async () => {
    vi.mocked(createPublication).mockRejectedValue(new Error("El asset X no tiene variante para STORY."))

    const req = new Request("http://localhost/api/publications", {
      method: "POST",
      body: JSON.stringify(validBody),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/no tiene variante/)
  })
})
