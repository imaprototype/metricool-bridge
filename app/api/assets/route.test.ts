import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/assets", () => ({
  listAssetsWithFilters: vi.fn(),
  uploadAssets: vi.fn(),
}))

import { listAssetsWithFilters, uploadAssets } from "@/lib/assets"
import { GET, POST } from "./route"

const VALID_BRAND_ID = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.mocked(listAssetsWithFilters).mockReset()
  vi.mocked(uploadAssets).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GET /api/assets", () => {
  it("traduce los query params a filtros tipados", async () => {
    vi.mocked(listAssetsWithFilters).mockResolvedValue({ data: [], page: 2, pageSize: 10, total: 0 })

    const url =
      "http://localhost/api/assets?brand=b1&category=iluminacion&objectType=lampara&photographer=p1" +
      "&tag=ceramica&kind=IMAGE&unusedSince=2026-01-01&neverUsed=false&page=2&pageSize=10"

    const res = await GET(new Request(url))
    await res.json()

    expect(res.status).toBe(200)
    expect(listAssetsWithFilters).toHaveBeenCalledWith({
      brandId: "b1",
      category: "iluminacion",
      objectType: "lampara",
      photographerId: "p1",
      tag: "ceramica",
      kind: "IMAGE",
      unusedSince: new Date("2026-01-01"),
      neverUsed: false,
      page: 2,
      pageSize: 10,
    })
  })

  it("ignora un kind que no sea IMAGE/VIDEO", async () => {
    vi.mocked(listAssetsWithFilters).mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 })

    await GET(new Request("http://localhost/api/assets?kind=bogus"))

    expect(listAssetsWithFilters).toHaveBeenCalledWith(expect.objectContaining({ kind: undefined }))
  })
})

describe("POST /api/assets", () => {
  function buildFormData(overrides: { files?: File[]; payload?: string | null } = {}) {
    const formData = new FormData()
    const files = overrides.files ?? [new File(["data"], "foto.jpg", { type: "image/jpeg" })]
    for (const file of files) formData.append("files", file)

    if (overrides.payload !== null) {
      formData.append(
        "payload",
        overrides.payload ??
          JSON.stringify({
            uploadedBy: "jm@norudsgn.com",
            assets: [
              {
                brandId: VALID_BRAND_ID,
                objectType: "lámpara de mesa",
                category: "iluminación",
                shortDescription: "Lámpara en cerámica.",
              },
            ],
          })
      )
    }
    return formData
  }

  it("sube un asset válido y devuelve 201", async () => {
    vi.mocked(uploadAssets).mockResolvedValue([{ id: "a1" } as never])

    const req = new Request("http://localhost/api/assets", { method: "POST", body: buildFormData() })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data).toEqual([{ id: "a1" }])
    expect(uploadAssets).toHaveBeenCalledTimes(1)
    const call = vi.mocked(uploadAssets).mock.calls[0][0]
    expect(call.uploadedBy).toBe("jm@norudsgn.com")
    expect(call.files).toHaveLength(1)
    expect(call.metadata).toHaveLength(1)
  })

  it("rechaza si no hay archivos", async () => {
    const req = new Request("http://localhost/api/assets", {
      method: "POST",
      body: buildFormData({ files: [] }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(uploadAssets).not.toHaveBeenCalled()
  })

  it("rechaza si falta el campo payload", async () => {
    const req = new Request("http://localhost/api/assets", {
      method: "POST",
      body: buildFormData({ payload: null }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(uploadAssets).not.toHaveBeenCalled()
  })

  it("rechaza si payload no es JSON válido", async () => {
    const req = new Request("http://localhost/api/assets", {
      method: "POST",
      body: buildFormData({ payload: "{esto no es json" }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it("rechaza si payload no cumple el schema (falta brandId)", async () => {
    const req = new Request("http://localhost/api/assets", {
      method: "POST",
      body: buildFormData({
        payload: JSON.stringify({
          uploadedBy: "jm@norudsgn.com",
          assets: [{ objectType: "x", category: "y", shortDescription: "z" }],
        }),
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(uploadAssets).not.toHaveBeenCalled()
  })

  it("rechaza si el número de archivos y de entradas de metadata no coincide", async () => {
    const twoFiles = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ]
    const req = new Request("http://localhost/api/assets", {
      method: "POST",
      body: buildFormData({ files: twoFiles }), // payload por defecto trae solo 1 entrada
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(uploadAssets).not.toHaveBeenCalled()
  })
})
