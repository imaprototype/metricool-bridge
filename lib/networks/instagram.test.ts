import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  MetricoolApiError,
  createPost,
  deletePost,
  getPost,
  instagramAdapter,
  listPosts,
  normalizeCollaborators,
  normalizeImageUrl,
  sanitizePostForWrite,
  toMetricoolDateTimeInfo,
  updatePost,
  validateAsset,
} from "./instagram"

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  })
}

function textResponse(body: string, init: { status?: number } = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "Content-Type": "text/plain" },
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

describe("listPosts", () => {
  it("unwraps { data: [...] } and sends auth header + query params", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }, { id: 2 }] }))

    const posts = await listPosts(
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2026-09-30T23:59:59.000Z")
    )

    expect(posts).toEqual([{ id: 1 }, { id: 2 }])
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain("/v2/scheduler/posts?")
    // Metricool exige yyyy-MM-dd'T'HH:mm:ss (sin offset) — confirmado contra la API real.
    expect(String(url)).toContain("start=2026-09-01T00%3A00%3A00")
    expect(String(url)).toContain("end=2026-09-30T23%3A59%3A59")
    expect(String(url)).toContain("blogId=456")
    expect(String(url)).toContain("userId=123")
    expect((init?.headers as Record<string, string>)["X-Mc-Auth"]).toBe("test-token")
  })
})

describe("getPost", () => {
  it("unwraps { data: {...} }", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: { id: 42 } }))

    const post = await getPost(42)

    expect(post).toEqual({ id: 42 })
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("/v2/scheduler/posts/42")
  })
})

describe("createPost / updatePost", () => {
  it("sanitiza el payload antes de enviarlo y devuelve el post creado", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: { id: 100 } }))

    const result = await createPost({
      text: "hola",
      creationDate: "2026-01-01",
      uuid: "abc",
      providers: ["instagram"],
    })

    expect(result).toEqual({ id: 100 })
    const [, init] = vi.mocked(fetch).mock.calls[0]
    const sentBody = JSON.parse(init?.body as string)
    expect(sentBody).toEqual({ text: "hola", providers: [{ network: "instagram" }] })
  })

  it("PUT devuelve un id nuevo que hay que persistir (rotación de id de Metricool)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: { id: 999 } }))

    const result = await updatePost(100, { text: "editado" })

    expect(result.id).toBe(999)
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("/v2/scheduler/posts/100")
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("PUT")
  })

  it("rechaza collaborators como array de strings ANTES de llamar a fetch", async () => {
    await expect(
      createPost({ text: "hola", collaborators: ["amigo_handle"] })
    ).rejects.toThrow(/array de objetos.*no de strings/)

    expect(fetch).not.toHaveBeenCalled()
  })

  it("acepta collaborators como array de objetos { username }", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: { id: 1 } }))

    await createPost({ text: "hola", collaborators: [{ username: "amigo_handle" }] })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    const sentBody = JSON.parse(init?.body as string)
    expect(sentBody.collaborators).toEqual([{ username: "amigo_handle" }])
  })
})

describe("deletePost", () => {
  it("unwraps { data: true }", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: true }))

    const result = await deletePost(1)

    expect(result).toBe(true)
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("DELETE")
  })
})

describe("normalizeImageUrl", () => {
  it("parsea la respuesta de texto plano (URL entre comillas)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      textResponse('"https://static.metricool.com/abc123.jpg"')
    )

    const url = await normalizeImageUrl("https://drive.google.com/foo.jpg")

    expect(url).toBe("https://static.metricool.com/abc123.jpg")
  })

  it("url-encoda la URL pública en el query param", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(textResponse('"https://static.metricool.com/x.jpg"'))

    await normalizeImageUrl("https://drive.google.com/foo bar.jpg")

    const [url] = vi.mocked(fetch).mock.calls[0]
    const parsed = new URL(String(url))
    expect(parsed.searchParams.get("url")).toBe("https://drive.google.com/foo bar.jpg")
  })
})

describe("errores de la API de Metricool", () => {
  it("lanza MetricoolApiError con el status cuando la respuesta no es ok", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "PublicationStatusCode" }, { status: 500 })
    )

    await expect(getPost(1)).rejects.toThrow(MetricoolApiError)
  })
})

describe("normalizeCollaborators", () => {
  it("rechaza un array de strings", () => {
    expect(() => normalizeCollaborators(["a", "b"])).toThrow(/array de objetos/)
  })

  it("acepta un array de objetos { username }", () => {
    expect(normalizeCollaborators([{ username: "a" }])).toEqual([{ username: "a" }])
  })
})

describe("sanitizePostForWrite", () => {
  it("elimina los campos de solo lectura antes de reenviar un GET como PUT", () => {
    const clean = sanitizePostForWrite({
      id: 1,
      text: "hola",
      creationDate: "2026-01-01",
      hasNotReadNotes: false,
      uuid: "abc",
      creatorUserMail: "a@b.com",
      creatorUserId: 1,
      status: "PUBLISHED",
      detailedStatus: "OK",
    })

    expect(clean).toEqual({ id: 1, text: "hola" })
  })

  it("simplifica providers a [{ network }]", () => {
    const clean = sanitizePostForWrite({ providers: [{ network: "instagram", status: "OK" }] })
    expect(clean.providers).toEqual([{ network: "instagram", status: "OK" }])
  })
})

describe("validateAsset", () => {
  it("acepta un Story exactamente 9:16", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1920 }, "STORY")
    ).not.toThrow()
  })

  it("rechaza un Story que no sea exactamente 9:16", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1350 }, "STORY")
    ).toThrow(/exige exactamente/)
  })

  it("acepta un feed post dentro de la tolerancia de ratio", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1440 }, "FEED_POST")
    ).not.toThrow()
  })

  it("rechaza un feed post muy fuera del ratio 4:5", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1080 }, "FEED_POST")
    ).toThrow(/fuera de la tolerancia/)
  })
})

describe("instagramAdapter.buildProviderPayload", () => {
  it("marca type STORY y autoPublish para Stories", () => {
    const payload = instagramAdapter.buildProviderPayload({
      format: "STORY",
      target: { network: "instagram" },
    })
    expect(payload).toEqual({ type: "STORY", autoPublish: true })
  })

  it("marca type POST para el resto de formatos", () => {
    const payload = instagramAdapter.buildProviderPayload({
      format: "FEED_POST",
      target: { network: "instagram" },
    })
    expect(payload).toEqual({ type: "POST" })
  })
})

describe("toMetricoolDateTimeInfo", () => {
  it("convierte un instante UTC a la hora de pared de la zona pedida (no la misma hora reloj en UTC)", () => {
    // 2026-07-15T10:00:00Z es verano en Madrid (CEST, UTC+2) -> 12:00 local.
    const result = toMetricoolDateTimeInfo(new Date("2026-07-15T10:00:00.000Z"), "Europe/Madrid")
    expect(result).toEqual({ dateTime: "2026-07-15T12:00:00", timezone: "Europe/Madrid" })
  })

  it("respeta el cambio de invierno/verano (DST) de la zona", () => {
    // 2026-01-15T10:00:00Z es invierno en Madrid (CET, UTC+1) -> 11:00 local.
    const result = toMetricoolDateTimeInfo(new Date("2026-01-15T10:00:00.000Z"), "Europe/Madrid")
    expect(result).toEqual({ dateTime: "2026-01-15T11:00:00", timezone: "Europe/Madrid" })
  })

  it("no aplica offset cuando la zona es UTC", () => {
    const result = toMetricoolDateTimeInfo(new Date("2026-07-15T10:00:00.000Z"), "UTC")
    expect(result).toEqual({ dateTime: "2026-07-15T10:00:00", timezone: "UTC" })
  })
})
