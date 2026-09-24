import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { listBoards, pinterestAdapter, validateAsset } from "./pinterest"

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  vi.stubEnv("METRICOOL_USER_TOKEN", "test-token")
  vi.stubEnv("METRICOOL_USER_ID", "123")
  vi.stubEnv("METRICOOL_BLOG_ID", "456")
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("validateAsset", () => {
  it("acepta un Pin dentro de la tolerancia del ratio 2:3", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1000, height: 1500 }, "PIN")
    ).not.toThrow()
  })

  it("rechaza un Pin muy fuera del ratio 2:3", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1000, height: 1000 }, "PIN")
    ).toThrow(/fuera de la tolerancia/)
  })

  it("rechaza un formato que Pinterest no soporta", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1440 }, "FEED_POST")
    ).toThrow(/no soporta el formato/)
  })
})

describe("pinterestAdapter.buildProviderPayload", () => {
  it("exige boardId", () => {
    expect(() =>
      pinterestAdapter.buildProviderPayload({ format: "PIN", target: { network: "pinterest" } })
    ).toThrow(/requiere boardId/)
  })

  it("construye pinterestData con boardId/pinTitle/pinLink", () => {
    const payload = pinterestAdapter.buildProviderPayload({
      format: "PIN",
      target: { network: "pinterest", boardId: "b1", pinTitle: "Título", pinLink: "https://noru.com/p" },
    })
    expect(payload).toEqual({ boardId: "b1", pinTitle: "Título", pinLink: "https://noru.com/p" })
  })
})

describe("listBoards", () => {
  it("unwraps { data: [...] } de GET /v2/scheduler/boards/pinterest", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: [{ id: "1", name: "Interiors" }] })
    )

    const boards = await listBoards()

    expect(boards).toEqual([{ id: "1", name: "Interiors" }])
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("/v2/scheduler/boards/pinterest")
  })
})
