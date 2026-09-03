import { eq } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { photographers } from "@/db/schema"

export type Photographer = InferSelectModel<typeof photographers>
export type NewPhotographer = InferInsertModel<typeof photographers>

export async function listPhotographers(): Promise<Photographer[]> {
  return getDb().select().from(photographers).orderBy(photographers.name)
}

export async function getPhotographerById(id: string): Promise<Photographer | undefined> {
  const [photographer] = await getDb().select().from(photographers).where(eq(photographers.id, id))
  return photographer
}

export async function createPhotographer(
  data: Omit<NewPhotographer, "id" | "createdAt">
): Promise<Photographer> {
  const [photographer] = await getDb().insert(photographers).values(data).returning()
  return photographer
}

export async function updatePhotographer(
  id: string,
  data: Partial<Omit<NewPhotographer, "id" | "createdAt">>
): Promise<Photographer | undefined> {
  const [photographer] = await getDb()
    .update(photographers)
    .set(data)
    .where(eq(photographers.id, id))
    .returning()
  return photographer
}

export async function deletePhotographer(id: string): Promise<void> {
  await getDb().delete(photographers).where(eq(photographers.id, id))
}
