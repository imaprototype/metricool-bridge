import { eq } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { publicationTargets } from "@/db/schema"

export type PublicationTarget = InferSelectModel<typeof publicationTargets>
export type NewPublicationTarget = InferInsertModel<typeof publicationTargets>

export async function listTargetsForPublication(publicationId: string): Promise<PublicationTarget[]> {
  return getDb()
    .select()
    .from(publicationTargets)
    .where(eq(publicationTargets.publicationId, publicationId))
}

export async function getPublicationTargetById(id: string): Promise<PublicationTarget | undefined> {
  const [target] = await getDb().select().from(publicationTargets).where(eq(publicationTargets.id, id))
  return target
}

export async function createPublicationTarget(
  data: Omit<NewPublicationTarget, "id" | "status">
): Promise<PublicationTarget> {
  const [target] = await getDb().insert(publicationTargets).values(data).returning()
  return target
}

export async function updatePublicationTarget(
  id: string,
  data: Partial<Omit<NewPublicationTarget, "id" | "publicationId">>
): Promise<PublicationTarget | undefined> {
  const [target] = await getDb()
    .update(publicationTargets)
    .set(data)
    .where(eq(publicationTargets.id, id))
    .returning()
  return target
}

export async function deletePublicationTarget(id: string): Promise<void> {
  await getDb().delete(publicationTargets).where(eq(publicationTargets.id, id))
}
