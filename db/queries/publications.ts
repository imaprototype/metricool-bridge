import { desc, eq } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { publications } from "@/db/schema"

export type Publication = InferSelectModel<typeof publications>
export type NewPublication = InferInsertModel<typeof publications>

export async function listPublications(): Promise<Publication[]> {
  return getDb().select().from(publications).orderBy(desc(publications.publicationDate))
}

export async function getPublicationById(id: string): Promise<Publication | undefined> {
  const [publication] = await getDb().select().from(publications).where(eq(publications.id, id))
  return publication
}

export async function createPublication(
  data: Omit<NewPublication, "id" | "status" | "lastSyncedAt" | "lastDriftNote">
): Promise<Publication> {
  const [publication] = await getDb().insert(publications).values(data).returning()
  return publication
}

export async function updatePublication(
  id: string,
  data: Partial<Omit<NewPublication, "id">>
): Promise<Publication | undefined> {
  const [publication] = await getDb()
    .update(publications)
    .set(data)
    .where(eq(publications.id, id))
    .returning()
  return publication
}

export async function deletePublication(id: string): Promise<void> {
  await getDb().delete(publications).where(eq(publications.id, id))
}
