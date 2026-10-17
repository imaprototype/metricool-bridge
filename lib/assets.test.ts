import sharp from "sharp"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/blob", () => ({
  uploadAsset: vi.fn(async (key: string) => ({
    url: `https://blob.test.invalid/${key}`,
    pathname: key,
  })),
}))

vi.mock("@/db/queries/assetImages", () => ({
  listAllImages: vi.fn(),
  updateAssetImageVariants: vi.fn(),
  listImagesForAssets: vi.fn(),
  createAssetImage: vi.fn(),
}))

import { uploadAsset as uploadToBlob } from "@/lib/blob"
import { listAllImages, updateAssetImageVariants } from "@/db/queries/assetImages"
import { backfillMissingVariants } from "./assets"

async function testImageBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 1200, height: 1200, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toBuffer()
}

// El catálogo completo hoy: FEED_POST/CAROUSEL/STORY/REEL/VIDEO_POST
// (Instagram) + PIN (Pinterest) + FB_POST (Facebook).
const ALL_INSTAGRAM_PINTEREST_FORMATS = {
  FEED_POST: "https://blob.test/feed.jpg",
  CAROUSEL: "https://blob.test/carousel.jpg",
  STORY: "https://blob.test/story.jpg",
  REEL: "https://blob.test/reel.jpg",
  VIDEO_POST: "https://blob.test/video_post.jpg",
  PIN: "https://blob.test/pin.jpg",
}

beforeEach(() => {
  vi.mocked(uploadToBlob).mockClear()
  vi.mocked(listAllImages).mockReset()
  vi.mocked(updateAssetImageVariants).mockReset()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const buffer = await testImageBuffer()
      return new Response(new Uint8Array(buffer), { status: 200 })
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("backfillMissingVariants", () => {
  it("genera solo el formato que falta (FB_POST), sin regenerar los que ya existen", async () => {
    vi.mocked(listAllImages).mockResolvedValue([
      {
        id: "img-missing-fb",
        assetId: "asset-1",
        kind: "IMAGE",
        originalBlobUrl: "https://blob.test/original.jpg",
        variants: ALL_INSTAGRAM_PINTEREST_FORMATS,
        sourceFilename: "a.jpg",
        position: 0,
        createdAt: new Date(),
      },
    ] as never)
    vi.mocked(updateAssetImageVariants).mockResolvedValue({} as never)

    const result = await backfillMissingVariants(10)

    expect(result.totalMissing).toBe(1)
    expect(result.processed).toBe(1)
    expect(result.remaining).toBe(0)
    expect(result.updated).toEqual([
      { assetImageId: "img-missing-fb", assetId: "asset-1", addedFormats: ["FB_POST"] },
    ])

    // Solo se sube UN nuevo blob (el de FB_POST) — los otros 6 formatos no se regeneran.
    expect(uploadToBlob).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadToBlob).mock.calls[0][0]).toContain("FB_POST")

    const [, mergedVariants] = vi.mocked(updateAssetImageVariants).mock.calls[0]
    expect(Object.keys(mergedVariants).sort()).toEqual(
      [...Object.keys(ALL_INSTAGRAM_PINTEREST_FORMATS), "FB_POST"].sort()
    )
    // Las URLs de los formatos que ya existían no cambian.
    expect(mergedVariants.FEED_POST).toBe(ALL_INSTAGRAM_PINTEREST_FORMATS.FEED_POST)
  })

  it("no toca una imagen que ya tiene todos los formatos", async () => {
    vi.mocked(listAllImages).mockResolvedValue([
      {
        id: "img-complete",
        assetId: "asset-1",
        kind: "IMAGE",
        originalBlobUrl: "https://blob.test/original.jpg",
        variants: { ...ALL_INSTAGRAM_PINTEREST_FORMATS, FB_POST: "https://blob.test/fb.jpg" },
        sourceFilename: "a.jpg",
        position: 0,
        createdAt: new Date(),
      },
    ] as never)

    const result = await backfillMissingVariants(10)

    expect(result).toEqual({ totalMissing: 0, processed: 0, remaining: 0, updated: [] })
    expect(fetch).not.toHaveBeenCalled()
    expect(uploadToBlob).not.toHaveBeenCalled()
    expect(updateAssetImageVariants).not.toHaveBeenCalled()
  })

  it("ignora imágenes de vídeo — no tienen variantes por formato", async () => {
    vi.mocked(listAllImages).mockResolvedValue([
      {
        id: "img-video",
        assetId: "asset-1",
        kind: "VIDEO",
        originalBlobUrl: "https://blob.test/original.mp4",
        variants: { thumbnail: "https://blob.test/thumb.jpg" },
        sourceFilename: "a.mp4",
        position: 0,
        createdAt: new Date(),
      },
    ] as never)

    const result = await backfillMissingVariants(10)

    expect(result).toEqual({ totalMissing: 0, processed: 0, remaining: 0, updated: [] })
    expect(updateAssetImageVariants).not.toHaveBeenCalled()
  })

  it("respeta el límite y reporta cuántas quedan pendientes", async () => {
    const images = ["img-1", "img-2", "img-3"].map((id) => ({
      id,
      assetId: "asset-1",
      kind: "IMAGE" as const,
      originalBlobUrl: "https://blob.test/original.jpg",
      variants: ALL_INSTAGRAM_PINTEREST_FORMATS,
      sourceFilename: "a.jpg",
      position: 0,
      createdAt: new Date(),
    }))
    vi.mocked(listAllImages).mockResolvedValue(images as never)
    vi.mocked(updateAssetImageVariants).mockResolvedValue({} as never)

    const result = await backfillMissingVariants(2)

    expect(result.totalMissing).toBe(3)
    expect(result.processed).toBe(2)
    expect(result.remaining).toBe(1)
    expect(result.updated).toHaveLength(2)
  })

  it("lanza un error claro si no puede descargar el original", async () => {
    vi.mocked(listAllImages).mockResolvedValue([
      {
        id: "img-missing-fb",
        assetId: "asset-1",
        kind: "IMAGE",
        originalBlobUrl: "https://blob.test/original.jpg",
        variants: ALL_INSTAGRAM_PINTEREST_FORMATS,
        sourceFilename: "a.jpg",
        position: 0,
        createdAt: new Date(),
      },
    ] as never)
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })))

    await expect(backfillMissingVariants(10)).rejects.toThrow(/No se pudo descargar el original/)
    expect(updateAssetImageVariants).not.toHaveBeenCalled()
  })
})
