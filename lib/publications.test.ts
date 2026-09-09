import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/db/queries/publications", () => ({
  createPublication: vi.fn(),
  updatePublication: vi.fn(),
  deletePublication: vi.fn(),
  getPublicationById: vi.fn(),
}))
vi.mock("@/db/queries/publicationTargets", () => ({
  createPublicationTarget: vi.fn(),
  listTargetsForPublication: vi.fn(),
  updatePublicationTarget: vi.fn(),
}))
vi.mock("@/db/queries/assetUsages", () => ({
  recordAssetUsage: vi.fn(),
}))
vi.mock("@/db/queries/assetImages", () => ({
  listImagesForAsset: vi.fn(),
}))
vi.mock("@/lib/networks/instagram", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/networks/instagram")>()
  return {
    ...actual,
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
    normalizeImageUrl: vi.fn(),
  }
})

import { listImagesForAsset } from "@/db/queries/assetImages"
import { recordAssetUsage } from "@/db/queries/assetUsages"
import {
  createPublication as createPublicationRow,
  deletePublication as deletePublicationRow,
  getPublicationById,
  updatePublication as updatePublicationRow,
} from "@/db/queries/publications"
import {
  createPublicationTarget,
  listTargetsForPublication,
  updatePublicationTarget,
} from "@/db/queries/publicationTargets"
import * as instagram from "@/lib/networks/instagram"
import {
  createPublication,
  createStoryForPublication,
  deletePublication,
  updatePublication,
} from "./publications"

function mockImage(id: string, assetId: string, variants: Record<string, string>, position = 0) {
  return {
    id,
    assetId,
    kind: "IMAGE" as const,
    originalBlobUrl: "https://blob.test/original.jpg",
    variants,
    sourceFilename: "a.jpg",
    position,
    createdAt: new Date(),
  }
}

beforeEach(() => {
  vi.mocked(listImagesForAsset).mockReset()
  vi.mocked(recordAssetUsage).mockReset()
  vi.mocked(createPublicationRow).mockReset()
  vi.mocked(updatePublicationRow).mockReset()
  vi.mocked(deletePublicationRow).mockReset()
  vi.mocked(getPublicationById).mockReset()
  vi.mocked(createPublicationTarget).mockReset()
  vi.mocked(listTargetsForPublication).mockReset()
  vi.mocked(updatePublicationTarget).mockReset()
  vi.mocked(instagram.createPost).mockReset()
  vi.mocked(instagram.updatePost).mockReset()
  vi.mocked(instagram.deletePost).mockReset()
  vi.mocked(instagram.normalizeImageUrl).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createPublication", () => {
  it("usa la portada (primera imagen) por defecto, normaliza la media, crea el post y registra AssetUsage", async () => {
    vi.mocked(listImagesForAsset).mockResolvedValue([
      mockImage("img-1", "asset-1", { FEED_POST: "https://blob.test/feed.jpg" }),
    ] as never)
    vi.mocked(instagram.normalizeImageUrl).mockResolvedValue("https://static.metricool.com/feed.jpg")
    vi.mocked(createPublicationRow).mockResolvedValue({
      id: "pub-1",
      format: "FEED_POST",
      publicationDate: new Date("2026-09-10T10:00:00Z"),
      text: "hola",
      assetId: "asset-1",
      imageIds: ["img-1"],
      status: "PENDING",
      lastSyncedAt: null,
      lastDriftNote: null,
    } as never)
    vi.mocked(instagram.createPost).mockResolvedValue({ id: 999 })
    vi.mocked(createPublicationTarget).mockResolvedValue({
      id: "target-1",
      publicationId: "pub-1",
      network: "instagram",
      metricoolId: 999,
      collaborators: null,
      status: "PENDING",
    } as never)
    vi.mocked(updatePublicationRow).mockResolvedValue({} as never)

    const result = await createPublication({
      format: "FEED_POST",
      assetId: "asset-1",
      text: "hola",
      publicationDate: new Date("2026-09-10T10:00:00Z"),
      targets: [{ network: "instagram" }],
    })

    expect(instagram.normalizeImageUrl).toHaveBeenCalledWith("https://blob.test/feed.jpg")
    const payload = vi.mocked(instagram.createPost).mock.calls[0][0]
    expect(payload.media).toEqual(["https://static.metricool.com/feed.jpg"])
    expect(payload.instagramData).toEqual({ type: "POST" })
    // Metricool exige { dateTime, timezone } — un string ISO da 500 (confirmado
    // contra la API real en el smoke test de la Fase 9).
    expect(payload.publicationDate).toEqual({
      dateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
      timezone: "Europe/Madrid",
    })

    expect(createPublicationRow).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: "asset-1", imageIds: ["img-1"] })
    )
    expect(createPublicationTarget).toHaveBeenCalledWith(
      expect.objectContaining({ publicationId: "pub-1", network: "instagram", metricoolId: 999 })
    )
    expect(recordAssetUsage).toHaveBeenCalledWith({
      assetId: "asset-1",
      publicationId: "pub-1",
      network: "instagram",
    })
    expect(result.targets).toHaveLength(1)

    // Bug real reportado por el usuario: un createPost que no lanza solo
    // confirma que Metricool aceptó programar el post, no que ya esté
    // publicado — el status raíz debe seguir siendo PENDING, igual que el
    // del target, no forzarse a PUBLISHED.
    expect(result.status).toBe("PENDING")
    expect(updatePublicationRow).not.toHaveBeenCalled()
  })

  it("CAROUSEL usa todas las imágenes de la ficha en orden si no se indican imageIds", async () => {
    vi.mocked(listImagesForAsset).mockResolvedValue([
      mockImage("img-1", "asset-1", { CAROUSEL: "https://blob.test/a.jpg" }, 0),
      mockImage("img-2", "asset-1", { CAROUSEL: "https://blob.test/b.jpg" }, 1),
    ] as never)
    vi.mocked(instagram.normalizeImageUrl).mockImplementation(async (url) => `https://static.metricool.com/${url}`)
    vi.mocked(createPublicationRow).mockResolvedValue({ id: "pub-1", format: "CAROUSEL" } as never)
    vi.mocked(instagram.createPost).mockResolvedValue({ id: 1 })
    vi.mocked(createPublicationTarget).mockResolvedValue({ id: "t1" } as never)

    await createPublication({
      format: "CAROUSEL",
      assetId: "asset-1",
      text: "carrusel",
      publicationDate: new Date(),
      targets: [{ network: "instagram" }],
    })

    expect(createPublicationRow).toHaveBeenCalledWith(
      expect.objectContaining({ imageIds: ["img-1", "img-2"] })
    )
    const payload = vi.mocked(instagram.createPost).mock.calls[0][0]
    expect(payload.media).toHaveLength(2)
  })

  it("rechaza imageIds explícitos que resuelvan a más de una imagen para un formato de una sola", async () => {
    vi.mocked(listImagesForAsset).mockResolvedValue([
      mockImage("img-1", "asset-1", { FEED_POST: "https://blob.test/a.jpg" }, 0),
      mockImage("img-2", "asset-1", { FEED_POST: "https://blob.test/b.jpg" }, 1),
    ] as never)

    await expect(
      createPublication({
        format: "FEED_POST",
        assetId: "asset-1",
        imageIds: ["img-1", "img-2"],
        text: "hola",
        publicationDate: new Date(),
        targets: [{ network: "instagram" }],
      })
    ).rejects.toThrow(/admite una sola imagen/)

    expect(instagram.createPost).not.toHaveBeenCalled()
  })

  it("rechaza un imageId que no pertenece a la ficha", async () => {
    vi.mocked(listImagesForAsset).mockResolvedValue([
      mockImage("img-1", "asset-1", { FEED_POST: "https://blob.test/a.jpg" }, 0),
    ] as never)

    await expect(
      createPublication({
        format: "FEED_POST",
        assetId: "asset-1",
        imageIds: ["img-de-otra-ficha"],
        text: "hola",
        publicationDate: new Date(),
        targets: [{ network: "instagram" }],
      })
    ).rejects.toThrow(/no pertenece al asset/)
  })

  it("marca autoPublish y type STORY para Stories", async () => {
    vi.mocked(listImagesForAsset).mockResolvedValue([
      mockImage("img-1", "asset-1", { STORY: "https://blob.test/story.jpg" }),
    ] as never)
    vi.mocked(instagram.normalizeImageUrl).mockResolvedValue("https://static.metricool.com/story.jpg")
    vi.mocked(createPublicationRow).mockResolvedValue({
      id: "pub-1",
      format: "STORY",
      assetId: "asset-1",
    } as never)
    vi.mocked(instagram.createPost).mockResolvedValue({ id: 1 })
    vi.mocked(createPublicationTarget).mockResolvedValue({ id: "t1" } as never)
    vi.mocked(updatePublicationRow).mockResolvedValue({} as never)

    await createPublication({
      format: "STORY",
      assetId: "asset-1",
      text: "",
      publicationDate: new Date(),
      targets: [{ network: "instagram" }],
    })

    const payload = vi.mocked(instagram.createPost).mock.calls[0][0]
    expect(payload.autoPublish).toBe(true)
    expect(payload.instagramData).toEqual({ type: "STORY", autoPublish: true })
  })

  it("falla claro si la imagen no tiene variante para el formato pedido", async () => {
    vi.mocked(listImagesForAsset).mockResolvedValue([mockImage("img-1", "asset-1", {})] as never)

    await expect(
      createPublication({
        format: "FEED_POST",
        assetId: "asset-1",
        text: "hola",
        publicationDate: new Date(),
        targets: [{ network: "instagram" }],
      })
    ).rejects.toThrow(/no tiene una variante generada/)

    expect(instagram.createPost).not.toHaveBeenCalled()
  })

  it("marca la publicación como ERROR si Metricool falla, en vez de dejarla huérfana en PENDING", async () => {
    // Bug real encontrado en el smoke test de la Fase 9: un createPost
    // fallido dejaba la fila de Publication en PENDING para siempre, sin
    // ningún target asociado, sin reflejar que la creación no llegó a
    // completarse en Metricool.
    vi.mocked(listImagesForAsset).mockResolvedValue([
      mockImage("img-1", "asset-1", { FEED_POST: "https://blob.test/feed.jpg" }),
    ] as never)
    vi.mocked(instagram.normalizeImageUrl).mockResolvedValue("https://static.metricool.com/feed.jpg")
    vi.mocked(createPublicationRow).mockResolvedValue({ id: "pub-1" } as never)
    vi.mocked(instagram.createPost).mockRejectedValue(new Error("Metricool respondió 500"))

    await expect(
      createPublication({
        format: "FEED_POST",
        assetId: "asset-1",
        text: "hola",
        publicationDate: new Date(),
        targets: [{ network: "instagram" }],
      })
    ).rejects.toThrow("Metricool respondió 500")

    expect(updatePublicationRow).toHaveBeenCalledWith("pub-1", { status: "ERROR" })
    expect(createPublicationTarget).not.toHaveBeenCalled()
  })
})

describe("updatePublication", () => {
  it("hace PUT a cada target y persiste el nuevo metricoolId (rotación de id de Metricool)", async () => {
    vi.mocked(getPublicationById).mockResolvedValue({
      id: "pub-1",
      format: "FEED_POST",
      text: "viejo",
      publicationDate: new Date("2026-09-10T10:00:00Z"),
      timezone: "Europe/Madrid",
      assetId: "asset-1",
      imageIds: ["img-1"],
    } as never)
    vi.mocked(listImagesForAsset).mockResolvedValue([
      mockImage("img-1", "asset-1", { FEED_POST: "https://blob.test/feed.jpg" }),
    ] as never)
    vi.mocked(instagram.normalizeImageUrl).mockResolvedValue("https://static.metricool.com/feed.jpg")
    vi.mocked(updatePublicationRow).mockResolvedValue({
      id: "pub-1",
      format: "FEED_POST",
      text: "nuevo",
      assetId: "asset-1",
      imageIds: ["img-1"],
    } as never)
    vi.mocked(listTargetsForPublication).mockResolvedValue([
      { id: "target-1", publicationId: "pub-1", network: "instagram", metricoolId: 100, collaborators: null },
    ] as never)
    vi.mocked(instagram.updatePost).mockResolvedValue({ id: 200 })
    vi.mocked(updatePublicationTarget).mockResolvedValue({
      id: "target-1",
      metricoolId: 200,
    } as never)

    const result = await updatePublication("pub-1", { text: "nuevo" })

    expect(instagram.updatePost).toHaveBeenCalledWith(100, expect.objectContaining({ text: "nuevo" }))
    expect(updatePublicationTarget).toHaveBeenCalledWith("target-1", { metricoolId: 200 })
    expect(result?.targets[0].metricoolId).toBe(200)
  })

  it("devuelve undefined si la publicación no existe", async () => {
    vi.mocked(getPublicationById).mockResolvedValue(undefined)
    const result = await updatePublication("nope", { text: "x" })
    expect(result).toBeUndefined()
    expect(instagram.updatePost).not.toHaveBeenCalled()
  })
})

describe("deletePublication", () => {
  it("borra en Metricool cada target y luego la fila interna", async () => {
    vi.mocked(getPublicationById).mockResolvedValue({ id: "pub-1" } as never)
    vi.mocked(listTargetsForPublication).mockResolvedValue([
      { id: "t1", network: "instagram", metricoolId: 100 },
    ] as never)
    vi.mocked(instagram.deletePost).mockResolvedValue(true)

    const result = await deletePublication("pub-1")

    expect(instagram.deletePost).toHaveBeenCalledWith(100)
    expect(deletePublicationRow).toHaveBeenCalledWith("pub-1")
    expect(result).toBe(true)
  })

  it("devuelve false si la publicación no existe, sin llamar a Metricool", async () => {
    vi.mocked(getPublicationById).mockResolvedValue(undefined)
    const result = await deletePublication("nope")
    expect(result).toBe(false)
    expect(instagram.deletePost).not.toHaveBeenCalled()
  })
})

describe("createStoryForPublication", () => {
  it("reutiliza la ficha de la publicación origen (portada por defecto, no el resto de imageIds del origen)", async () => {
    vi.mocked(getPublicationById).mockResolvedValue({
      id: "pub-1",
      assetId: "asset-1",
      imageIds: ["img-1", "img-2"], // origen era un CAROUSEL con 2 imágenes
      text: "texto original",
      timezone: "Europe/Madrid",
    } as never)
    vi.mocked(listImagesForAsset).mockResolvedValue([
      mockImage("img-1", "asset-1", { STORY: "https://blob.test/story.jpg" }, 0),
      mockImage("img-2", "asset-1", { STORY: "https://blob.test/story2.jpg" }, 1),
    ] as never)
    vi.mocked(instagram.normalizeImageUrl).mockResolvedValue("https://static.metricool.com/story.jpg")
    vi.mocked(createPublicationRow).mockResolvedValue({
      id: "pub-2",
      format: "STORY",
      assetId: "asset-1",
    } as never)
    vi.mocked(instagram.createPost).mockResolvedValue({ id: 1 })
    vi.mocked(createPublicationTarget).mockResolvedValue({ id: "t1" } as never)
    vi.mocked(updatePublicationRow).mockResolvedValue({} as never)

    await createStoryForPublication("pub-1", { publicationDate: new Date() })

    expect(createPublicationRow).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: "asset-1", imageIds: ["img-1"], text: "texto original" })
    )
  })
})
