"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { archiveAsset, updateAsset } from "@/db/queries/assets"
import { createBrand, type Brand } from "@/db/queries/brands"
import { createPhotographer, type Photographer } from "@/db/queries/photographers"
import { uploadAssets, type AssetMetadataInput } from "@/lib/assets"
import { auth } from "@/lib/auth"

export async function archiveAssetAction(id: string): Promise<void> {
  await archiveAsset(id)
  revalidatePath("/assets")
}

const updateAssetSchema = z.object({
  objectType: z.string().min(1),
  productUrl: z.union([z.url(), z.literal("")]).optional(),
  inspirationUrl: z.union([z.url(), z.literal("")]).optional(),
  shortDescription: z.string().min(1),
  tags: z.string().optional(),
  photographerIds: z.array(z.uuid()),
})

export interface UpdateAssetActionState {
  error?: string
}

export async function updateAssetAction(
  id: string,
  _prevState: UpdateAssetActionState,
  formData: FormData
): Promise<UpdateAssetActionState> {
  const parsed = updateAssetSchema.safeParse({
    ...Object.fromEntries(formData),
    photographerIds: formData.getAll("photographerIds"),
  })
  if (!parsed.success) {
    return { error: "Revisa los campos: " + z.prettifyError(parsed.error) }
  }

  await updateAsset(id, {
    objectType: parsed.data.objectType,
    productUrl: parsed.data.productUrl || null,
    inspirationUrl: parsed.data.inspirationUrl || null,
    shortDescription: parsed.data.shortDescription,
    photographerIds: parsed.data.photographerIds,
    tags: parsed.data.tags
      ? parsed.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [],
  })

  revalidatePath("/assets")
  return {}
}

const createBrandSchema = z.object({
  name: z.string().min(1),
  instagramHandle: z.string().optional(),
})

export interface CreateBrandActionState {
  error?: string
  created?: Brand
}

export async function createBrandAction(
  _prevState: CreateBrandActionState,
  formData: FormData
): Promise<CreateBrandActionState> {
  const parsed = createBrandSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: "El nombre de la marca es obligatorio." }
  const created = await createBrand({
    name: parsed.data.name,
    instagramHandle: parsed.data.instagramHandle || undefined,
  })
  revalidatePath("/assets")
  revalidatePath("/assets/upload")
  return { created }
}

const createPhotographerSchema = z.object({
  name: z.string().min(1),
  instagramHandle: z.string().optional(),
})

export interface CreatePhotographerActionState {
  error?: string
  created?: Photographer
}

export async function createPhotographerAction(
  _prevState: CreatePhotographerActionState,
  formData: FormData
): Promise<CreatePhotographerActionState> {
  const parsed = createPhotographerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: "El nombre del fotógrafo es obligatorio." }
  const created = await createPhotographer({
    name: parsed.data.name,
    instagramHandle: parsed.data.instagramHandle || undefined,
  })
  revalidatePath("/assets")
  revalidatePath("/assets/upload")
  return { created }
}

export interface UploadAssetsActionState {
  error?: string
  successCount?: number
}

/**
 * Recibe FormData construido en el cliente: `files` (uno o más) y
 * `metadata` (JSON string, un objeto AssetMetadataInput por archivo, mismo
 * orden). `uploadedBy` se resuelve de la sesión, no del formulario.
 */
export async function uploadAssetsAction(
  _prevState: UploadAssetsActionState,
  formData: FormData
): Promise<UploadAssetsActionState> {
  const session = await auth()
  const uploadedBy = session?.user?.email
  if (!uploadedBy) {
    return { error: "Sesión no válida — vuelve a iniciar sesión." }
  }

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File)
  const metadataRaw = formData.get("metadata")

  if (files.length === 0) {
    return { error: "Selecciona al menos un archivo." }
  }
  if (typeof metadataRaw !== "string") {
    return { error: "Falta la metadata de los archivos." }
  }

  let metadata: AssetMetadataInput[]
  try {
    metadata = JSON.parse(metadataRaw)
  } catch {
    return { error: "La metadata no es JSON válido." }
  }

  if (metadata.length !== files.length) {
    return { error: "El número de archivos y de entradas de metadata no coincide." }
  }

  try {
    const created = await uploadAssets({ uploadedBy, files, metadata })
    revalidatePath("/assets")
    return { successCount: created.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error subiendo los archivos." }
  }
}
