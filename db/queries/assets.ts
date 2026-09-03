import { desc, eq } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { assets } from "@/db/schema"

export type Asset = InferSelectModel<typeof assets>
export type NewAsset = InferInsertModel<typeof assets>

/**
 * CRUD interno de bajo nivel — filtros (marca, categoría, `unusedSince`...) y
 * generación de variantes viven en `lib/assets.ts` (Fase 4), no aquí.
 */
export async function listAssets(): Promise<Asset[]> {
  return getDb().select().from(assets).orderBy(desc(assets.uploadedAt))
}

export async function getAssetById(id: string): Promise<Asset | undefined> {
  const [asset] = await getDb().select().from(assets).where(eq(assets.id, id))
  return asset
}

export async function createAsset(data: Omit<NewAsset, "id" | "uploadedAt" | "status">): Promise<Asset> {
  const [asset] = await getDb().insert(assets).values(data).returning()
  return asset
}

export async function updateAsset(
  id: string,
  data: Partial<Omit<NewAsset, "id" | "uploadedAt">>
): Promise<Asset | undefined> {
  const [asset] = await getDb().update(assets).set(data).where(eq(assets.id, id)).returning()
  return asset
}

/** DELETE /api/assets/:id archiva, no borra — el blob se conserva salvo que se pida explícitamente. */
export async function archiveAsset(id: string): Promise<Asset | undefined> {
  const [asset] = await getDb()
    .update(assets)
    .set({ status: "ARCHIVED" })
    .where(eq(assets.id, id))
    .returning()
  return asset
}
