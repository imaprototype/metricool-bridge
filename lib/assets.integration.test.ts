import { eq } from "drizzle-orm"
import sharp from "sharp"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/blob", () => ({
  uploadAsset: vi.fn(async (key: string) => ({
    url: `https://blob.test.invalid/${key}`,
    pathname: key,
  })),
}))

import { getDb } from "@/lib/db"
import { assets } from "@/db/schema"
import { createBrand, deleteBrand, type Brand } from "@/db/queries/brands"
import { recordAssetUsage } from "@/db/queries/assetUsages"
import { createPublication, deletePublication } from "@/db/queries/publications"
import { listAssetsWithFilters, uploadAssets } from "./assets"

async function makeTestImage(): Promise<File> {
  const buffer = await sharp({
    create: { width: 1200, height: 1200, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toBuffer()
  return new File([new Uint8Array(buffer)], "test.jpg", { type: "image/jpeg" })
}

/**
 * Test de integración real contra Neon (sharp/variantes reales, Blob
 * mockeado porque BLOB_READ_WRITE_TOKEN aún no está configurado). Solo
 * corre con `npm run test:integration`, no en `npm test`.
 */
describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("lib/assets (integración contra Neon)", () => {
  let brand: Brand
  const createdAssetIds: string[] = []

  beforeEach(async () => {
    brand = await createBrand({ name: `Test Brand ${Date.now()}` })
  })

  afterEach(async () => {
    const db = getDb()
    for (const id of createdAssetIds.splice(0)) {
      await db.delete(assets).where(eq(assets.id, id))
    }
    await deleteBrand(brand.id)
  })

  it("uploadAssets genera variantes por cada formato del adaptador y persiste el asset", async () => {
    const file = await makeTestImage()

    const [created] = await uploadAssets({
      uploadedBy: "jm@norudsgn.com",
      files: [file],
      metadata: [
        {
          brandId: brand.id,
          objectType: "lámpara de mesa",
          photographerIds: ["11111111-1111-4111-8111-111111111111"],
          inspirationUrl: "https://instagram.com/p/inspiracion123",
          shortDescription: "Lámpara en cerámica.",
          tags: ["ceramica"],
        },
      ],
    })
    createdAssetIds.push(created.id)

    expect(created.kind).toBe("IMAGE")
    expect(created.inspirationUrl).toBe("https://instagram.com/p/inspiracion123")
    expect(created.photographerIds).toEqual(["11111111-1111-4111-8111-111111111111"])
    expect(Object.keys(created.variants as object).sort()).toEqual(
      ["CAROUSEL", "FEED_POST", "REEL", "STORY", "VIDEO_POST"].sort()
    )

    const byPhotographer = await listAssetsWithFilters({
      brandId: brand.id,
      photographerId: "11111111-1111-4111-8111-111111111111",
    })
    expect(byPhotographer.data.map((a) => a.id)).toEqual([created.id])
  })

  it("listAssetsWithFilters filtra por tag, brand y neverUsed, y pagina", async () => {
    const fileA = await makeTestImage()
    const fileB = await makeTestImage()

    const [assetWithTag] = await uploadAssets({
      uploadedBy: "jm@norudsgn.com",
      files: [fileA],
      metadata: [
        {
          brandId: brand.id,
          objectType: "silla",
          shortDescription: "Silla de madera.",
          tags: ["madera-test"],
        },
      ],
    })
    createdAssetIds.push(assetWithTag.id)

    const [assetWithoutTag] = await uploadAssets({
      uploadedBy: "jm@norudsgn.com",
      files: [fileB],
      metadata: [
        {
          brandId: brand.id,
          objectType: "cojín",
          shortDescription: "Cojín de lino.",
        },
      ],
    })
    createdAssetIds.push(assetWithoutTag.id)

    const publication = await createPublication({
      format: "FEED_POST",
      publicationDate: new Date("2026-09-10T10:00:00Z"),
      text: "Post de prueba",
      assetIds: [assetWithTag.id],
    })

    try {
      await recordAssetUsage({ assetId: assetWithTag.id, publicationId: publication.id, network: "instagram" })

      const byTag = await listAssetsWithFilters({ brandId: brand.id, tag: "madera-test" })
      expect(byTag.data.map((a) => a.id)).toEqual([assetWithTag.id])
      expect(byTag.data[0].usages).toHaveLength(1)

      const neverUsed = await listAssetsWithFilters({ brandId: brand.id, neverUsed: true })
      expect(neverUsed.data.map((a) => a.id)).toEqual([assetWithoutTag.id])

      const byBrand = await listAssetsWithFilters({ brandId: brand.id, pageSize: 1, page: 1 })
      expect(byBrand.total).toBe(2)
      expect(byBrand.data).toHaveLength(1)
      expect(byBrand.pageSize).toBe(1)
    } finally {
      // ON DELETE CASCADE se lleva por delante el asset_usages asociado.
      await deletePublication(publication.id)
    }
  })
})
