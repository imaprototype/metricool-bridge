import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/db/queries/publications", () => ({
  updatePublication: vi.fn(),
}))
vi.mock("@/db/queries/syncLogs", () => ({
  recordSyncLog: vi.fn(),
}))
vi.mock("@/lib/publications", () => ({
  listPublicationsWithTargets: vi.fn(),
  networkClientFor: vi.fn(),
}))

import { updatePublication } from "@/db/queries/publications"
import { recordSyncLog } from "@/db/queries/syncLogs"
import { listPublicationsWithTargets, networkClientFor } from "@/lib/publications"
import { verifyPublications } from "./verify"

beforeEach(() => {
  vi.mocked(updatePublication).mockReset()
  vi.mocked(recordSyncLog).mockReset()
  vi.mocked(listPublicationsWithTargets).mockReset()
  vi.mocked(networkClientFor).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function publicationFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pub-1",
    format: "FEED_POST",
    publicationDate: new Date("2026-09-10T10:00:00.000Z"),
    timezone: "UTC",
    text: "hola",
    assetIds: ["asset-1"],
    status: "PUBLISHED",
    lastSyncedAt: null,
    lastDriftNote: null,
    targets: [
      { id: "target-1", publicationId: "pub-1", network: "instagram", metricoolId: 100, collaborators: null },
    ],
    ...overrides,
  }
}

describe("verifyPublications", () => {
  it("no marca drift cuando la fecha en Metricool coincide con la esperada (con margen de segundos)", async () => {
    vi.mocked(listPublicationsWithTargets).mockResolvedValue([publicationFixture()] as never)
    // Metricool trunca los segundos al guardar — sigue sin ser drift.
    const getPost = vi
      .fn()
      .mockResolvedValue({ id: 100, publicationDate: { dateTime: "2026-09-10T10:00:00", timezone: "UTC" } })
    vi.mocked(networkClientFor).mockReturnValue({ getPost } as never)

    const result = await verifyPublications({ from: new Date(), to: new Date() })

    expect(result.driftCount).toBe(0)
    expect(result.checked).toBe(1)
    expect(recordSyncLog).toHaveBeenCalledWith(expect.objectContaining({ driftDetected: false }))
  })

  it("marca drift cuando Metricool recolocó la fecha en silencio", async () => {
    vi.mocked(listPublicationsWithTargets).mockResolvedValue([publicationFixture()] as never)
    const getPost = vi
      .fn()
      .mockResolvedValue({ id: 100, publicationDate: { dateTime: "2026-09-11T08:00:00", timezone: "UTC" } })
    vi.mocked(networkClientFor).mockReturnValue({ getPost } as never)

    const result = await verifyPublications({ from: new Date(), to: new Date() })

    expect(result.driftCount).toBe(1)
    expect(result.drifts[0].driftDetected).toBe(true)
    expect(updatePublication).toHaveBeenCalledWith(
      "pub-1",
      expect.objectContaining({ lastDriftNote: expect.stringContaining("Drift") })
    )
  })

  it("marca drift si el post ya no existe en Metricool (404)", async () => {
    vi.mocked(listPublicationsWithTargets).mockResolvedValue([publicationFixture()] as never)
    const getPost = vi.fn().mockRejectedValue(new Error("404"))
    vi.mocked(networkClientFor).mockReturnValue({ getPost } as never)

    const result = await verifyPublications({ from: new Date(), to: new Date() })

    expect(result.drifts[0].driftDetected).toBe(true)
    expect(result.drifts[0].actual).toBeNull()
  })

  it("marca drift si Metricool devuelve otra zona horaria aunque la hora local coincida", async () => {
    vi.mocked(listPublicationsWithTargets).mockResolvedValue([publicationFixture()] as never)
    const getPost = vi
      .fn()
      .mockResolvedValue({ id: 100, publicationDate: { dateTime: "2026-09-10T10:00:00", timezone: "Europe/Madrid" } })
    vi.mocked(networkClientFor).mockReturnValue({ getPost } as never)

    const result = await verifyPublications({ from: new Date(), to: new Date() })

    expect(result.drifts[0].driftDetected).toBe(true)
  })

  it("ignora targets sin metricoolId todavía", async () => {
    vi.mocked(listPublicationsWithTargets).mockResolvedValue([
      publicationFixture({
        targets: [{ id: "t1", publicationId: "pub-1", network: "instagram", metricoolId: null }],
      }),
    ] as never)

    const result = await verifyPublications({ from: new Date(), to: new Date() })

    expect(result.checked).toBe(0)
    expect(networkClientFor).not.toHaveBeenCalled()
  })
})
