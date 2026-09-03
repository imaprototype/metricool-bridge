import { desc, eq } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { assetUsages } from "@/db/schema"

export type AssetUsage = InferSelectModel<typeof assetUsages>
export type NewAssetUsage = InferInsertModel<typeof assetUsages>

/** Se llama automáticamente al crear una Publication (Fase 6), una vez por red/target. */
export async function recordAssetUsage(data: Omit<NewAssetUsage, "id" | "usedAt">): Promise<AssetUsage> {
  const [usage] = await getDb().insert(assetUsages).values(data).returning()
  return usage
}

export async function listUsagesForAsset(assetId: string): Promise<AssetUsage[]> {
  return getDb()
    .select()
    .from(assetUsages)
    .where(eq(assetUsages.assetId, assetId))
    .orderBy(desc(assetUsages.usedAt))
}
