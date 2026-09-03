import { randomUUID } from "node:crypto"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { assetUsages, assets } from "@/db/schema"
import { createAsset, type Asset, type NewAsset } from "@/db/queries/assets"
import type { AssetUsage } from "@/db/queries/assetUsages"
import { generateVariants } from "@/lib/images"
import { extractThumbnail } from "@/lib/video"
import { uploadAsset as uploadToBlob } from "@/lib/blob"
import { getNetworkAdapter } from "@/lib/networks"

export interface AssetMetadataInput {
  brandId: string
  photographerId?: string
  objectType: string
  category: string
  productUrl?: string
  inspirationUrl?: string
  shortDescription: string
  targetAudience?: string
  tags?: string[]
}

export interface UploadAssetsInput {
  uploadedBy: string
  files: File[]
  metadata: AssetMetadataInput[]
}

/** Sube uno o varios archivos: Blob + variantes por red + fila en `assets`, uno por archivo. */
export async function uploadAssets({ uploadedBy, files, metadata }: UploadAssetsInput): Promise<Asset[]> {
  const created: Asset[] = []
  for (let i = 0; i < files.length; i++) {
    created.push(await uploadSingleAsset(files[i], metadata[i], uploadedBy))
  }
  return created
}

async function uploadSingleAsset(file: File, meta: AssetMetadataInput, uploadedBy: string): Promise<Asset> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const kind: NewAsset["kind"] = file.type.startsWith("video/") ? "VIDEO" : "IMAGE"

  const original = await uploadToBlob(`assets/original/${randomUUID()}-${file.name}`, buffer, {
    contentType: file.type || undefined,
  })

  const variants = kind === "IMAGE" ? await generateImageVariants(buffer) : await generateVideoVariants(buffer)

  return createAsset({
    kind,
    originalBlobUrl: original.url,
    variants,
    brandId: meta.brandId,
    photographerId: meta.photographerId,
    objectType: meta.objectType,
    category: meta.category,
    productUrl: meta.productUrl,
    inspirationUrl: meta.inspirationUrl,
    shortDescription: meta.shortDescription,
    targetAudience: meta.targetAudience,
    tags: meta.tags ?? [],
    sourceFilename: file.name,
    uploadedBy,
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
  category?: string
  objectType?: string
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

export type AssetWithUsages = Asset & { usages: AssetUsage[] }

export interface ListAssetsResult {
  data: AssetWithUsages[]
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
  if (filters.category) conditions.push(eq(assets.category, filters.category))
  if (filters.objectType) conditions.push(eq(assets.objectType, filters.objectType))
  if (filters.photographerId) conditions.push(eq(assets.photographerId, filters.photographerId))
  if (filters.kind) conditions.push(eq(assets.kind, filters.kind))
  if (filters.tag) conditions.push(sql`${filters.tag} = ANY(${assets.tags})`)

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
  const usages = ids.length ? await db.select().from(assetUsages).where(inArray(assetUsages.assetId, ids)) : []

  const usagesByAsset = new Map<string, AssetUsage[]>()
  for (const usage of usages) {
    const list = usagesByAsset.get(usage.assetId) ?? []
    list.push(usage)
    usagesByAsset.set(usage.assetId, list)
  }

  return {
    data: rows.map((row) => ({ ...row, usages: usagesByAsset.get(row.id) ?? [] })),
    page,
    pageSize,
    total: countRows[0]?.count ?? 0,
  }
}

export async function getAssetWithUsages(id: string): Promise<AssetWithUsages | undefined> {
  const db = getDb()
  const [asset] = await db.select().from(assets).where(eq(assets.id, id))
  if (!asset) return undefined
  const usages = await db.select().from(assetUsages).where(eq(assetUsages.assetId, id))
  return { ...asset, usages }
}
