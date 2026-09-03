import { eq } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { brands } from "@/db/schema"

export type Brand = InferSelectModel<typeof brands>
export type NewBrand = InferInsertModel<typeof brands>

export async function listBrands(): Promise<Brand[]> {
  return getDb().select().from(brands).orderBy(brands.name)
}

export async function getBrandById(id: string): Promise<Brand | undefined> {
  const [brand] = await getDb().select().from(brands).where(eq(brands.id, id))
  return brand
}

export async function createBrand(data: Omit<NewBrand, "id" | "createdAt">): Promise<Brand> {
  const [brand] = await getDb().insert(brands).values(data).returning()
  return brand
}

export async function updateBrand(
  id: string,
  data: Partial<Omit<NewBrand, "id" | "createdAt">>
): Promise<Brand | undefined> {
  const [brand] = await getDb().update(brands).set(data).where(eq(brands.id, id)).returning()
  return brand
}

export async function deleteBrand(id: string): Promise<void> {
  await getDb().delete(brands).where(eq(brands.id, id))
}
