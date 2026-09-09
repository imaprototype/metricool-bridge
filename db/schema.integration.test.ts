import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { getDb } from "@/lib/db"
import { assets } from "./schema"
import { createBrand, deleteBrand } from "./queries/brands"
import { createPhotographer, deletePhotographer } from "./queries/photographers"
import { createAsset, getAssetById } from "./queries/assets"
import { createAssetImage } from "./queries/assetImages"
import { createPublication, deletePublication, getPublicationById } from "./queries/publications"
import { createPublicationTarget, listTargetsForPublication } from "./queries/publicationTargets"
import { listUsagesForAsset, recordAssetUsage } from "./queries/assetUsages"
import { listSyncLogsForEntity, recordSyncLog } from "./queries/syncLogs"

/**
 * Test de integración real contra Neon — solo corre si se le pide
 * explícitamente (ver `npm run test:integration`), para que `npm test` no
 * escriba en la base de datos por accidente en cada ejecución.
 */
describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("schema (integración contra Neon)", () => {
  it("hace un round-trip completo por las 7 tablas y las deja limpias", async () => {
    const brand = await createBrand({
      name: `Test Brand ${Date.now()}`,
      instagramHandle: "@test_brand",
      toneNotes: "cercano, directo",
      targetAudience: "diseñadores de interior",
    })

    const photographer = await createPhotographer({
      name: "Test Photographer",
      instagramHandle: "@test_photog",
    })

    // `let` fuera del try: en JS, `try {}` y `finally {}` son bloques con
    // scope propio, así que una `const` declarada dentro del try no sería
    // visible en el finally para el cleanup.
    let asset: Awaited<ReturnType<typeof createAsset>> | undefined

    try {
      asset = await createAsset({
        brandId: brand.id,
        photographerIds: [photographer.id],
        objectType: "lámpara de mesa",
        productUrl: "https://noru.example.com/products/lampara-x",
        inspirationUrl: "https://instagram.com/p/inspiracion123",
        shortDescription: "Lámpara de mesa en cerámica, luz cálida.",
        tags: ["cerámica", "luz-calida"],
        uploadedBy: "jm@norudsgn.com",
      })

      const image = await createAssetImage({
        assetId: asset.id,
        kind: "IMAGE",
        originalBlobUrl: "https://blob.vercel-storage.com/test-original.jpg",
        variants: { FEED_POST: "https://blob.vercel-storage.com/test-feed.jpg" },
        sourceFilename: "IMG_0001.jpg",
        position: 0,
      })

      expect(asset.inspirationUrl).toBe("https://instagram.com/p/inspiracion123")
      expect(asset.tags).toEqual(["cerámica", "luz-calida"])
      expect(image.variants).toEqual({ FEED_POST: "https://blob.vercel-storage.com/test-feed.jpg" })

      const fetchedAsset = await getAssetById(asset.id)
      expect(fetchedAsset?.id).toBe(asset.id)

      const publication = await createPublication({
        format: "FEED_POST",
        publicationDate: new Date("2026-09-10T10:00:00Z"),
        text: "Post de prueba",
        assetId: asset.id,
        imageIds: [image.id],
      })

      try {
        const target = await createPublicationTarget({
          publicationId: publication.id,
          network: "instagram",
          metricoolId: null,
          collaborators: [],
        })

        const targets = await listTargetsForPublication(publication.id)
        expect(targets.map((t) => t.id)).toContain(target.id)

        const usage = await recordAssetUsage({
          assetId: asset.id,
          publicationId: publication.id,
          network: "instagram",
        })

        const usages = await listUsagesForAsset(asset.id)
        expect(usages.map((u) => u.id)).toContain(usage.id)

        const log = await recordSyncLog({
          entityType: "PUBLICATION",
          entityId: publication.id,
          action: "CREATE",
          beforeState: null,
          afterState: { status: "PENDING" },
          driftDetected: false,
        })

        const logs = await listSyncLogsForEntity("PUBLICATION", publication.id)
        expect(logs.map((l) => l.id)).toContain(log.id)

        const fetchedPublication = await getPublicationById(publication.id)
        expect(fetchedPublication?.text).toBe("Post de prueba")
      } finally {
        // ON DELETE CASCADE se encarga de publication_targets y asset_usages;
        // sync_logs no tiene FK real (entityId es polimórfico), así que no hace falta borrarlo aparte.
        await deletePublication(publication.id)
      }
    } finally {
      // No hay deleteAsset en el CRUD público (DELETE /api/assets archiva, no
      // borra — ver db/queries/assets.ts). Para limpiar el test, borrado
      // directo aquí.
      if (asset) {
        await getDb().delete(assets).where(eq(assets.id, asset.id))
      }
      await deleteBrand(brand.id)
      await deletePhotographer(photographer.id)
    }
  })
})
