import { randomUUID } from "node:crypto"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { assetImages, assetUsages, assets } from "@/db/schema"
import { createAsset, type Asset } from "@/db/queries/assets"
import { createAssetImage, listImagesForAssets, type AssetImage } from "@/db/queries/assetImages"
import type { AssetUsage } from "@/db/queries/assetUsages"
import { generateVariants } from "@/lib/images"
import { extractThumbnail } from "@/lib/video"
import { uploadAsset as uploadToBlob } from "@/lib/blob"
import { getNetworkAdapter } from "@/lib/networks"

export interface AssetMetadataInput {
  brandId: string
  photographerIds?: string[]
  objectType: string
  productUrl?: string
  inspirationUrl?: string
  shortDescription: string
  tags?: string[]
}

export interface UploadAssetInput {
  uploadedBy: string
  files: File[]
  metadata: AssetMetadataInput
}

export type AssetWithImages = Asset & { images: AssetImage[] }

/**
 * Sube una ficha con una o varias imágenes: todos los archivos comparten la
 * misma metadata (marca, fotógrafos, descripción...) y se guardan como una
 * sola fila de Asset con N AssetImage — no una fila de Asset por archivo.
 */
export async function uploadAsset({ uploadedBy, files, metadata }: UploadAssetInput): Promise<AssetWithImages> {
  if (files.length === 0) throw new Error("Selecciona al menos un archivo.")

  const kinds = files.map((file) => (file.type.startsWith("video/") ? ("VIDEO" as const) : ("IMAGE" as const)))
  if (new Set(kinds).size > 1) {
    throw new Error("Todos los archivos de una ficha deben ser del mismo tipo (todas imágenes o todos vídeos).")
  }

  const asset = await createAsset({
    brandId: metadata.brandId,
    photographerIds: metadata.photographerIds ?? [],
    objectType: metadata.objectType,
    productUrl: metadata.productUrl,
    inspirationUrl: metadata.inspirationUrl,
    shortDescription: metadata.shortDescription,
    tags: metadata.tags ?? [],
    uploadedBy,
  })

  const images: AssetImage[] = []
  for (let i = 0; i < files.length; i++) {
    images.push(await uploadSingleImage(asset.id, files[i], kinds[i], i))
  }

  return { ...asset, images }
}

async function uploadSingleImage(
  assetId: string,
  file: File,
  kind: "IMAGE" | "VIDEO",
  position: number
): Promise<AssetImage> {
  const buffer = Buffer.from(await file.arrayBuffer())

  const original = await uploadToBlob(`assets/original/${randomUUID()}-${file.name}`, buffer, {
    contentType: file.type || undefined,
  })

  const variants = kind === "IMAGE" ? await generateImageVariants(buffer) : await generateVideoVariants(buffer)

  return createAssetImage({
    assetId,
    kind,
    originalBlobUrl: original.url,
    variants,
    sourceFilename: file.name,
    position,
  })
}

async function generateImageVariants(buffer: Buffer): Promise<Record<string, string>> {
  // Hoy solo hay adaptador de Instagram — cuando se registren más redes en
  // lib/networks/index.ts, unir aquí sus catálogos de ratios.
  const adapter = getNetworkAdapter("instagram")
  const variantBuffers = await generateVariants(buffer, adapter.aspectRatios)

  const entries = await Promise.all(
    Object.entries(variantBuffers).map(async ([format, variantBuffer]) => {
      const uploaded = await uploadToBlob(`assets/variants/${randomUUID()}-${format}.jpg`, variantBuffer, {
        contentType: "image/jpeg",
      })
      return [format, uploaded.url] as const
    })
  )

  return Object.fromEntries(entries)
}

async function generateVideoVariants(buffer: Buffer): Promise<Record<string, string>> {
  const thumbnail = await extractThumbnail(buffer)
  const uploaded = await uploadToBlob(`assets/thumbnails/${randomUUID()}.jpg`, thumbnail, {
    contentType: "image/jpeg",
  })
  return { thumbnail: uploaded.url }
}

export interface ListAssetsFilters {
  brandId?: string
  objectType?: string
  /** Coincide si este fotógrafo está entre los de photographerIds. */
  photographerId?: string
  tag?: string
  kind?: "IMAGE" | "VIDEO"
  /** Assets sin uso desde esta fecha (o nunca usados). */
  unusedSince?: Date
  /** Assets sin ningún AssetUsage jamás — más estricto que unusedSince. */
  neverUsed?: boolean
  page?: number
  pageSize?: number
}

export type AssetWithDetails = Asset & { usages: AssetUsage[]; images: AssetImage[] }

export interface ListAssetsResult {
  data: AssetWithDetails[]
  page: number
  pageSize: number
  total: number
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

export async function listAssetsWithFilters(filters: ListAssetsFilters = {}): Promise<ListAssetsResult> {
  const page = filters.page && filters.page > 0 ? filters.page : 1
  const pageSize =
    filters.pageSize && filters.pageSize > 0 ? Math.min(filters.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE

  const conditions = [eq(assets.status, "ACTIVE")]
  if (filters.brandId) conditions.push(eq(assets.brandId, filters.brandId))
  if (filters.objectType) conditions.push(eq(assets.objectType, filters.objectType))
  if (filters.photographerId) {
    conditions.push(sql`${filters.photographerId} = ANY(${assets.photographerIds})`)
  }
  if (filters.tag) conditions.push(sql`${filters.tag} = ANY(${assets.tags})`)
  if (filters.kind) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${assetImages} WHERE ${assetImages.assetId} = ${assets.id} AND ${assetImages.kind} = ${filters.kind})`
    )
  }

  if (filters.neverUsed) {
    conditions.push(
      sql`NOT EXISTS (SELECT 1 FROM ${assetUsages} WHERE ${assetUsages.assetId} = ${assets.id})`
    )
  } else if (filters.unusedSince) {
    conditions.push(
      sql`NOT EXISTS (SELECT 1 FROM ${assetUsages} WHERE ${assetUsages.assetId} = ${assets.id} AND ${assetUsages.usedAt} >= ${filters.unusedSince})`
    )
  }

  const where = and(...conditions)
  const db = getDb()

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(assets)
      .where(where)
      .orderBy(desc(assets.uploadedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(assets).where(where),
  ])

  const ids = rows.map((row) => row.id)
  const [usages, images] = await Promise.all([
    ids.length ? db.select().from(assetUsages).where(inArray(assetUsages.assetId, ids)) : Promise.resolve([]),
    listImagesForAssets(ids),
  ])

  const usagesByAsset = new Map<string, AssetUsage[]>()
  for (const usage of usages) {
    const list = usagesByAsset.get(usage.assetId) ?? []
    list.push(usage)
    usagesByAsset.set(usage.assetId, list)
  }

  const imagesByAsset = new Map<string, AssetImage[]>()
  for (const image of images) {
    const list = imagesByAsset.get(image.assetId) ?? []
    list.push(image)
    imagesByAsset.set(image.assetId, list)
  }

  return {
    data: rows.map((row) => ({
      ...row,
      usages: usagesByAsset.get(row.id) ?? [],
      images: imagesByAsset.get(row.id) ?? [],
    })),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
  }
}

export async function getAssetWithUsages(id: string): Promise<AssetWithDetails | undefined> {
  const db = getDb()
  const [asset] = await db.select().from(assets).where(eq(assets.id, id))
  if (!asset) return undefined
  const [usages, images] = await Promise.all([
    db.select().from(assetUsages).where(eq(assetUsages.assetId, id)),
    listImagesForAssets([id]),
  ])
  return { ...asset, usages, images }
}
