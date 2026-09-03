import {
  createPublication as createPublicationRow,
  deletePublication as deletePublicationRow,
  getPublicationById,
  updatePublication as updatePublicationRow,
  type Publication,
} from "@/db/queries/publications"
import {
  createPublicationTarget,
  listTargetsForPublication,
  updatePublicationTarget,
  type PublicationTarget,
} from "@/db/queries/publicationTargets"
import { recordAssetUsage } from "@/db/queries/assetUsages"
import { getAssetById } from "@/db/queries/assets"
import { getDb } from "@/lib/db"
import { publicationTargets, publications } from "@/db/schema"
import { and, gte, inArray, lte, sql } from "drizzle-orm"
import { getNetworkAdapter } from "@/lib/networks"
import type { PublicationFormat } from "@/lib/networks/types"
import * as instagram from "@/lib/networks/instagram"

export type PublicationWithTargets = Publication & { targets: PublicationTarget[] }

export interface PublicationTargetInput {
  network: string
  collaborators?: string[]
}

export interface CreatePublicationInput {
  format: PublicationFormat
  assetIds: string[]
  text: string
  publicationDate: Date
  targets: PublicationTargetInput[]
}

/**
 * Hoy solo hay un adaptador real (Instagram) — cuando se registre una
 * segunda red en lib/networks/index.ts, este switch pasa a ser el punto
 * único a extender para el CRUD real contra cada API (buildProviderPayload
 * / validateAsset ya son agnósticos vía NetworkAdapter, pero listPosts/
 * createPost/updatePost/deletePost/normalizeImageUrl no forman parte de
 * esa interfaz todavía).
 */
function networkClientFor(network: string) {
  if (network === "instagram") return instagram
  throw new Error(`No hay cliente de API implementado todavía para la red "${network}".`)
}

/** URLs de Vercel Blob de la variante correcta por asset — todavía no aptas para Metricool, ver `normalizeMediaForNetwork`. */
async function resolveMediaUrls(assetIds: string[], format: PublicationFormat): Promise<string[]> {
  const urls: string[] = []
  for (const assetId of assetIds) {
    const asset = await getAssetById(assetId)
    if (!asset) throw new Error(`Asset ${assetId} no encontrado.`)

    const variants = asset.variants as Record<string, string>
    const variantUrl = variants[format]
    if (!variantUrl) {
      throw new Error(
        `El asset ${assetId} no tiene una variante generada para el formato ${format}. Sube el archivo de nuevo o rellena la variante que falta.`
      )
    }
    urls.push(variantUrl)
  }
  return urls
}

/**
 * Metricool exige que `media` sean URLs ya re-hosteadas en
 * static.metricool.com, no URLs públicas arbitrarias — hay que pasar cada
 * una por `normalizeImageUrl` antes de enviarlas (ver ARCHITECTURE.md §5).
 */
async function normalizeMediaForNetwork(blobUrls: string[], network: string): Promise<string[]> {
  const client = networkClientFor(network)
  const normalized: string[] = []
  for (const url of blobUrls) {
    normalized.push(await client.normalizeImageUrl(url))
  }
  return normalized
}

function buildMetricoolPayload(params: {
  network: string
  format: PublicationFormat
  text: string
  publicationDate: Date
  media: string[]
  collaborators?: string[]
}): Record<string, unknown> {
  const adapter = getNetworkAdapter(params.network)
  const providerData = adapter.buildProviderPayload({
    format: params.format,
    target: { network: params.network, collaborators: params.collaborators },
  })

  const payload: Record<string, unknown> = {
    text: params.text,
    publicationDate: params.publicationDate.toISOString(),
    providers: [{ network: params.network }],
    media: params.media,
    [`${params.network}Data`]: providerData,
  }

  if (params.format === "STORY") {
    payload.autoPublish = true
  }
  if (params.collaborators?.length) {
    payload.collaborators = params.collaborators.map((username) => ({ username }))
  }

  return payload
}

export async function createPublication(input: CreatePublicationInput): Promise<PublicationWithTargets> {
  if (input.assetIds.length === 0) throw new Error("Una publicación necesita al menos un asset.")
  if (input.targets.length === 0) throw new Error("Una publicación necesita al menos un target.")

  const media = await resolveMediaUrls(input.assetIds, input.format)

  const publication = await createPublicationRow({
    format: input.format,
    publicationDate: input.publicationDate,
    text: input.text,
    assetIds: input.assetIds,
  })

  const targets: PublicationTarget[] = []
  for (const targetInput of input.targets) {
    const client = networkClientFor(targetInput.network)
    const normalizedMedia = await normalizeMediaForNetwork(media, targetInput.network)
    const payload = buildMetricoolPayload({
      network: targetInput.network,
      format: input.format,
      text: input.text,
      publicationDate: input.publicationDate,
      media: normalizedMedia,
      collaborators: targetInput.collaborators,
    })

    const created = await client.createPost(payload)

    const target = await createPublicationTarget({
      publicationId: publication.id,
      network: targetInput.network,
      metricoolId: created.id,
      collaborators: targetInput.collaborators ?? null,
    })
    targets.push(target)

    for (const assetId of input.assetIds) {
      await recordAssetUsage({ assetId, publicationId: publication.id, network: targetInput.network })
    }
  }

  await updatePublicationRow(publication.id, { status: "PUBLISHED" })

  return { ...publication, status: "PUBLISHED", targets }
}

export interface UpdatePublicationInput {
  text?: string
  assetIds?: string[]
  publicationDate?: Date
}

export async function updatePublication(
  id: string,
  input: UpdatePublicationInput
): Promise<PublicationWithTargets | undefined> {
  const existing = await getPublicationById(id)
  if (!existing) return undefined

  const text = input.text ?? existing.text
  const publicationDate = input.publicationDate ?? existing.publicationDate
  const assetIds = input.assetIds ?? existing.assetIds

  const media = await resolveMediaUrls(assetIds, existing.format)

  const updated = await updatePublicationRow(id, { text, publicationDate, assetIds })
  if (!updated) return undefined

  const existingTargets = await listTargetsForPublication(id)
  const newTargets: PublicationTarget[] = []

  for (const target of existingTargets) {
    if (target.metricoolId == null) {
      newTargets.push(target)
      continue
    }

    const client = networkClientFor(target.network)
    const normalizedMedia = await normalizeMediaForNetwork(media, target.network)
    const payload = buildMetricoolPayload({
      network: target.network,
      format: existing.format,
      text,
      publicationDate,
      media: normalizedMedia,
      collaborators: target.collaborators ?? undefined,
    })

    // Metricool no actualiza en sitio: el PUT borra el post y crea uno
    // nuevo con otro id — hay que capturar y persistir el id devuelto.
    const result = await client.updatePost(target.metricoolId, payload)
    const updatedTarget = await updatePublicationTarget(target.id, { metricoolId: result.id })
    newTargets.push(updatedTarget ?? target)
  }

  return { ...updated, targets: newTargets }
}

export async function deletePublication(id: string): Promise<boolean> {
  const existing = await getPublicationById(id)
  if (!existing) return false

  const targets = await listTargetsForPublication(id)
  for (const target of targets) {
    if (target.metricoolId == null) continue
    const client = networkClientFor(target.network)
    await client.deletePost(target.metricoolId)
  }

  // ON DELETE CASCADE se lleva por delante publication_targets y asset_usages.
  await deletePublicationRow(id)
  return true
}

export interface CreateStoryInput {
  publicationDate: Date
  text?: string
  assetIds?: string[]
}

/** Crea una Story asociada a una publicación existente, reutilizando sus assets por defecto. */
export async function createStoryForPublication(
  sourcePublicationId: string,
  input: CreateStoryInput
): Promise<PublicationWithTargets> {
  const source = await getPublicationById(sourcePublicationId)
  if (!source) throw new Error(`Publication ${sourcePublicationId} no encontrada.`)

  return createPublication({
    format: "STORY",
    assetIds: input.assetIds ?? source.assetIds,
    text: input.text ?? source.text,
    publicationDate: input.publicationDate,
    targets: [{ network: "instagram" }],
  })
}

export interface ListPublicationsFilters {
  from?: Date
  to?: Date
  network?: string
}

export async function listPublicationsWithTargets(
  filters: ListPublicationsFilters = {}
): Promise<PublicationWithTargets[]> {
  const db = getDb()
  const conditions = []
  if (filters.from) conditions.push(gte(publications.publicationDate, filters.from))
  if (filters.to) conditions.push(lte(publications.publicationDate, filters.to))
  if (filters.network) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${publicationTargets} WHERE ${publicationTargets.publicationId} = ${publications.id} AND ${publicationTargets.network} = ${filters.network})`
    )
  }

  const rows = await db
    .select()
    .from(publications)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(publications.publicationDate)

  const ids = rows.map((row) => row.id)
  const allTargets = ids.length
    ? await db.select().from(publicationTargets).where(inArray(publicationTargets.publicationId, ids))
    : []

  const targetsByPublication = new Map<string, PublicationTarget[]>()
  for (const target of allTargets) {
    const list = targetsByPublication.get(target.publicationId) ?? []
    list.push(target)
    targetsByPublication.set(target.publicationId, list)
  }

  return rows
    .map((row) => ({ ...row, targets: targetsByPublication.get(row.id) ?? [] }))
    .filter((row) => !filters.network || row.targets.some((t) => t.network === filters.network))
}

export async function getPublicationWithTargets(id: string): Promise<PublicationWithTargets | undefined> {
  const publication = await getPublicationById(id)
  if (!publication) return undefined
  const targets = await listTargetsForPublication(id)
  return { ...publication, targets }
}
