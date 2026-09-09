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
import { listImagesForAsset, type AssetImage } from "@/db/queries/assetImages"
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

// Debe coincidir con el default de la columna publications.timezone (db/schema.ts).
export const DEFAULT_TIMEZONE = "Europe/Madrid"

export interface CreatePublicationInput {
  format: PublicationFormat
  /** Una publicación referencia UNA ficha — un CAROUSEL usa varias imágenes de esa misma ficha. */
  assetId: string
  /**
   * Qué imágenes de la ficha usar, en orden. Si se omite: la portada
   * (primera imagen) para formatos de una sola imagen, o todas para CAROUSEL.
   */
  imageIds?: string[]
  text: string
  publicationDate: Date
  /** Zona IANA con la que se interpreta publicationDate al hablar con Metricool. */
  timezone?: string
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
export function networkClientFor(network: string) {
  if (network === "instagram") return instagram
  throw new Error(`No hay cliente de API implementado todavía para la red "${network}".`)
}

/**
 * Resuelve qué imágenes concretas de una ficha se usan para un formato dado.
 * Sin `imageIds` explícitos: portada (primera) para formatos de una imagen,
 * todas en orden para CAROUSEL. Con `imageIds`: se validan contra las
 * imágenes reales de la ficha y deben encajar con el formato (1 imagen
 * exacta salvo CAROUSEL).
 */
async function resolveImagesForPublication(
  assetId: string,
  format: PublicationFormat,
  imageIds?: string[]
): Promise<AssetImage[]> {
  const allImages = await listImagesForAsset(assetId)
  if (allImages.length === 0) {
    throw new Error(`El asset ${assetId} no tiene imágenes.`)
  }

  let selected: AssetImage[]
  if (imageIds && imageIds.length > 0) {
    const byId = new Map(allImages.map((image) => [image.id, image]))
    selected = imageIds.map((id) => {
      const image = byId.get(id)
      if (!image) throw new Error(`La imagen ${id} no pertenece al asset ${assetId}.`)
      return image
    })
  } else if (format === "CAROUSEL") {
    selected = allImages
  } else {
    selected = [allImages[0]]
  }

  if (format !== "CAROUSEL" && selected.length > 1) {
    throw new Error(`El formato ${format} admite una sola imagen; se han indicado ${selected.length}.`)
  }

  return selected
}

/** URLs de Vercel Blob de las imágenes ya resueltas — todavía no aptas para Metricool, ver `normalizeMediaForNetwork`. */
function resolveMediaUrls(images: AssetImage[], format: PublicationFormat): string[] {
  return images.map((image) => {
    const variants = image.variants as Record<string, string>
    const url = variants[format]
    if (!url) {
      throw new Error(
        `La imagen ${image.id} no tiene una variante generada para el formato ${format}. Sube el archivo de nuevo o rellena la variante que falta.`
      )
    }
    return url
  })
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
  timezone: string
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
    // Metricool exige { dateTime, timezone }, no un string ISO — ver
    // instagram.toMetricoolDateTimeInfo (confirmado contra la API real).
    publicationDate: instagram.toMetricoolDateTimeInfo(params.publicationDate, params.timezone),
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
  if (input.targets.length === 0) throw new Error("Una publicación necesita al menos un target.")

  const timezone = input.timezone ?? DEFAULT_TIMEZONE
  const images = await resolveImagesForPublication(input.assetId, input.format, input.imageIds)
  const resolvedImageIds = images.map((image) => image.id)
  const media = resolveMediaUrls(images, input.format)

  const publication = await createPublicationRow({
    format: input.format,
    assetId: input.assetId,
    imageIds: resolvedImageIds,
    publicationDate: input.publicationDate,
    timezone,
    text: input.text,
  })

  // createPublication no es transaccional con la API de Metricool: si un
  // createPost falla a mitad del bucle, sin este try/catch la fila de
  // Publication quedaría huérfana en PENDING para siempre, sin reflejar el
  // fallo (encontrado de verdad en el smoke test de la Fase 9 — un intento
  // fallido dejó una fila así). Los targets que sí llegaron a crearse en
  // Metricool antes del fallo se conservan (representan posts reales).
  const targets: PublicationTarget[] = []
  try {
    for (const targetInput of input.targets) {
      const client = networkClientFor(targetInput.network)
      const normalizedMedia = await normalizeMediaForNetwork(media, targetInput.network)
      const payload = buildMetricoolPayload({
        network: targetInput.network,
        format: input.format,
        text: input.text,
        publicationDate: input.publicationDate,
        timezone,
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

      await recordAssetUsage({ assetId: input.assetId, publicationId: publication.id, network: targetInput.network })
    }
  } catch (err) {
    await updatePublicationRow(publication.id, { status: "ERROR" })
    throw err
  }

  // `createPost` que no lanza solo confirma que Metricool aceptó programar
  // el post — no que ya se haya publicado de verdad. La fila ya nació en
  // PENDING (default de la tabla, igual que cada target) y así se queda;
  // pasar a PUBLISHED es cosa de /api/verify (o de un futuro sync) cuando
  // confirme que Metricool lo ha publicado realmente.
  return { ...publication, targets }
}

export interface UpdatePublicationInput {
  text?: string
  assetId?: string
  imageIds?: string[]
  publicationDate?: Date
  timezone?: string
}

export async function updatePublication(
  id: string,
  input: UpdatePublicationInput
): Promise<PublicationWithTargets | undefined> {
  const existing = await getPublicationById(id)
  if (!existing) return undefined

  const text = input.text ?? existing.text
  const publicationDate = input.publicationDate ?? existing.publicationDate
  const timezone = input.timezone ?? existing.timezone
  const assetId = input.assetId ?? existing.assetId

  const images = await resolveImagesForPublication(assetId, existing.format, input.imageIds ?? existing.imageIds)
  const resolvedImageIds = images.map((image) => image.id)
  const media = resolveMediaUrls(images, existing.format)

  const updated = await updatePublicationRow(id, {
    text,
    publicationDate,
    timezone,
    assetId,
    imageIds: resolvedImageIds,
  })
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
      timezone,
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
  /** Si se omite, la Story usa la portada de la ficha de la publicación origen. */
  imageIds?: string[]
}

/** Crea una Story asociada a una publicación existente, reutilizando su ficha y zona horaria por defecto. */
export async function createStoryForPublication(
  sourcePublicationId: string,
  input: CreateStoryInput
): Promise<PublicationWithTargets> {
  const source = await getPublicationById(sourcePublicationId)
  if (!source) throw new Error(`Publication ${sourcePublicationId} no encontrada.`)

  return createPublication({
    format: "STORY",
    assetId: source.assetId,
    imageIds: input.imageIds,
    text: input.text ?? source.text,
    publicationDate: input.publicationDate,
    timezone: source.timezone,
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
