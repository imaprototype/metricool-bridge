import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockExecute = vi.fn()
vi.mock("@/lib/db", () => ({
  getDb: () => ({ execute: mockExecute }),
}))
vi.mock("@/lib/networks/instagram", () => ({
  listPosts: vi.fn(),
}))

import * as instagram from "@/lib/networks/instagram"
import { GET } from "./route"

beforeEach(() => {
  mockExecute.mockReset()
  vi.mocked(instagram.listPosts).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GET /api/health", () => {
  it("devuelve 200 y ok:true cuando DB y Metricool responden", async () => {
    mockExecute.mockResolvedValue(undefined)
    vi.mocked(instagram.listPosts).mockResolvedValue([])

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.ok).toBe(true)
    expect(body.data.checks).toEqual({ database: true, metricool: true })
  })

  it("devuelve 503 y detalla el error cuando la DB falla", async () => {
    mockExecute.mockRejectedValue(new Error("connection refused"))
    vi.mocked(instagram.listPosts).mockResolvedValue([])

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.data.ok).toBe(false)
    expect(body.data.checks.database).toBe(false)
    expect(body.data.errors.database).toMatch(/connection refused/)
  })

  it("devuelve 503 cuando Metricool falla, sin tumbar la respuesta de DB", async () => {
    mockExecute.mockResolvedValue(undefined)
    vi.mocked(instagram.listPosts).mockRejectedValue(new Error("401"))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.data.checks).toEqual({ database: true, metricool: false })
  })
})
