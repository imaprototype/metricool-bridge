import { asc, eq, inArray } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { assetImages } from "@/db/schema"

export type AssetImage = InferSelectModel<typeof assetImages>
export type NewAssetImage = InferInsertModel<typeof assetImages>

export async function listImagesForAsset(assetId: string): Promise<AssetImage[]> {
  return getDb().select().from(assetImages).where(eq(assetImages.assetId, assetId)).orderBy(asc(assetImages.position))
}

/** Batch para listados (grid de /assets) — evita N+1. */
export async function listImagesForAssets(assetIds: string[]): Promise<AssetImage[]> {
  if (assetIds.length === 0) return []
  return getDb()
    .select()
    .from(assetImages)
    .where(inArray(assetImages.assetId, assetIds))
    .orderBy(asc(assetImages.position))
}

export async function createAssetImage(data: Omit<NewAssetImage, "id" | "createdAt">): Promise<AssetImage> {
  const [image] = await getDb().insert(assetImages).values(data).returning()
  return image
}
