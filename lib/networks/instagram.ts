import type {
  AspectRatio,
  BuildProviderPayloadParams,
  NetworkAdapter,
  NetworkAsset,
  PublicationFormat,
} from "./types"

const BASE_URL = "https://app.metricool.com/api"

export class MetricoolApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "MetricoolApiError"
    this.status = status
    this.body = body
  }
}

function getCredentials() {
  const token = process.env.METRICOOL_USER_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  const blogId = process.env.METRICOOL_BLOG_ID
  if (!token || !userId || !blogId) {
    throw new Error(
      "Faltan credenciales de Metricool: METRICOOL_USER_TOKEN, METRICOOL_USER_ID y METRICOOL_BLOG_ID deben estar definidas en el entorno."
    )
  }
  return { token, userId, blogId }
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const { userId, blogId } = getCredentials()
  const query = new URLSearchParams({ ...params, blogId, userId })
  return `${BASE_URL}${path}?${query.toString()}`
}

async function metricoolFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { token } = getCredentials()
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-Mc-Auth": token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => undefined)
    throw new MetricoolApiError(`Metricool respondió ${res.status} en ${url}`, res.status, body)
  }

  return res
}

/** Metricool envuelve la mayoría de respuestas en `{ data: ... }`. */
async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json()
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: T }).data
  }
  return json as T
}

export interface MetricoolPost {
  id: number
  [key: string]: unknown
}

/**
 * Metricool exige `start`/`end` en formato `yyyy-MM-dd'T'HH:mm:ss` (sin
 * offset de zona) — confirmado contra la API real, un `YYYY-MM-DD` a secas
 * da 400 ValidationError. Se recibe `Date` en vez de string para que
 * ningún llamador tenga que recordar el formato exacto.
 */
export async function listPosts(start: Date, end: Date): Promise<MetricoolPost[]> {
  const res = await metricoolFetch(
    buildUrl("/v2/scheduler/posts", { start: toMetricoolDateTime(start), end: toMetricoolDateTime(end) })
  )
  return unwrap<MetricoolPost[]>(res)
}

function toMetricoolDateTime(date: Date): string {
  return date.toISOString().slice(0, 19)
}

export async function getPost(id: number): Promise<MetricoolPost> {
  const res = await metricoolFetch(buildUrl(`/v2/scheduler/posts/${id}`))
  return unwrap<MetricoolPost>(res)
}

export async function createPost(payload: Record<string, unknown>): Promise<MetricoolPost> {
  const res = await metricoolFetch(buildUrl("/v2/scheduler/posts"), {
    method: "POST",
    body: JSON.stringify(sanitizePostForWrite(payload)),
  })
  return unwrap<MetricoolPost>(res)
}

/**
 * Metricool no actualiza en sitio: borra el post y crea uno nuevo con otro
 * id. El `id` en la respuesta es SIEMPRE el que hay que persistir a partir
 * de ahora — el `id` original queda inválido tras esta llamada.
 */
export async function updatePost(
  id: number,
  payload: Record<string, unknown>
): Promise<MetricoolPost> {
  const res = await metricoolFetch(buildUrl(`/v2/scheduler/posts/${id}`), {
    method: "PUT",
    body: JSON.stringify(sanitizePostForWrite(payload)),
  })
  return unwrap<MetricoolPost>(res)
}

export async function deletePost(id: number): Promise<boolean> {
  const res = await metricoolFetch(buildUrl(`/v2/scheduler/posts/${id}`), {
    method: "DELETE",
  })
  return unwrap<boolean>(res)
}

/**
 * Descarga la imagen desde una URL pública y la re-hostea en
 * static.metricool.com. La respuesta es texto plano (una URL entre
 * comillas), no JSON.
 */
export async function normalizeImageUrl(publicUrl: string): Promise<string> {
  // `buildUrl` construye el query string vía `URLSearchParams`, que ya
  // url-encoda cada valor — no hay que codificar `publicUrl` a mano aquí.
  const res = await metricoolFetch(buildUrl("/actions/normalize/image/url", { url: publicUrl }))
  const text = (await res.text()).trim()
  return text.replace(/^"|"$/g, "")
}

// --- Reglas de payload probadas a base de error 500 (ver ARCHITECTURE.md §5) ---

const READ_ONLY_FIELDS = [
  "creationDate",
  "hasNotReadNotes",
  "uuid",
  "creatorUserMail",
  "creatorUserId",
  "status",
  "detailedStatus",
] as const

/**
 * Limpia un post (típicamente obtenido por GET) antes de reenviarlo en un
 * POST/PUT: quita campos de solo lectura, simplifica `providers` y valida
 * `collaborators`.
 */
export function sanitizePostForWrite(post: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...post }

  for (const field of READ_ONLY_FIELDS) {
    delete clean[field]
  }

  if (Array.isArray(clean.providers)) {
    clean.providers = clean.providers.map((provider) =>
      typeof provider === "string" ? { network: provider } : provider
    )
  }

  if (clean.collaborators !== undefined) {
    clean.collaborators = normalizeCollaborators(clean.collaborators)
  }

  return clean
}

/**
 * `collaborators` va en la raíz del post como array de objetos
 * `{ username }`. Un array de strings provoca un 500 muy explícito en
 * Metricool — lo rechazamos aquí, antes de que la llamada salga a red.
 */
export function normalizeCollaborators(collaborators: unknown): { username: string }[] {
  if (!Array.isArray(collaborators)) {
    throw new Error("collaborators debe ser un array.")
  }

  return collaborators.map((entry) => {
    if (typeof entry === "string") {
      throw new Error(
        `collaborators debe ser un array de objetos { username }, no de strings (recibido: "${entry}"). Metricool responde 500 si se envía un array de strings.`
      )
    }
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { username?: unknown }).username !== "string"
    ) {
      throw new Error("Cada colaborador debe ser un objeto { username: string }.")
    }
    return { username: (entry as { username: string }).username }
  })
}

// --- Adaptador de red (interfaz NetworkAdapter, ver lib/networks/types.ts) ---

export const instagramAspectRatios: Record<PublicationFormat, AspectRatio> = {
  // 4:5 — estándar de esta cuenta, confirmado en sesión. Metricool no lo
  // exige exacto, así que se valida con tolerancia.
  FEED_POST: { w: 1080, h: 1440, exact: false },
  CAROUSEL: { w: 1080, h: 1440, exact: false },
  // 9:16 exacto — confirmado en sesión, Metricool rechaza cualquier otra
  // cosa con un error explícito.
  STORY: { w: 1080, h: 1920, exact: true },
  // No verificado contra Metricool esta sesión; asumido por convención de
  // Instagram (Reels se comporta como vídeo vertical, igual que Stories).
  // Ajustar si Metricool lo rechaza en la práctica.
  REEL: { w: 1080, h: 1920, exact: false },
  // No verificado contra Metricool esta sesión; asumido 4:5 como el feed.
  VIDEO_POST: { w: 1080, h: 1440, exact: false },
}

const RATIO_TOLERANCE = 0.02

export function validateAsset(asset: NetworkAsset, format: PublicationFormat): void {
  const expected = instagramAspectRatios[format]
  const actualRatio = asset.width / asset.height
  const expectedRatio = expected.w / expected.h

  if (expected.exact) {
    if (Math.abs(actualRatio - expectedRatio) > 1e-4) {
      throw new Error(
        `El asset ${asset.id} tiene ratio ${actualRatio.toFixed(4)} (${asset.width}x${asset.height}), pero ${format} en Instagram exige exactamente ${expectedRatio.toFixed(4)} (${expected.w}x${expected.h}). Metricool rechaza cualquier otra cosa.`
      )
    }
    return
  }

  const relativeDiff = Math.abs(actualRatio - expectedRatio) / expectedRatio
  if (relativeDiff > RATIO_TOLERANCE) {
    throw new Error(
      `El asset ${asset.id} tiene ratio ${actualRatio.toFixed(4)} (${asset.width}x${asset.height}), fuera de la tolerancia (${(RATIO_TOLERANCE * 100).toFixed(0)}%) del ratio esperado para ${format} (${expectedRatio.toFixed(4)}, ${expected.w}x${expected.h}).`
    )
  }
}

export function buildProviderPayload({ format }: BuildProviderPayloadParams): object {
  if (format === "STORY") {
    // Las Stories llevan autoPublish: true también a nivel raíz del post —
    // eso lo añade quien orquesta el payload completo (Fase 6), no este
    // bloque instagramData.
    return { type: "STORY", autoPublish: true }
  }
  return { type: "POST" }
}

export const instagramAdapter: NetworkAdapter = {
  name: "instagram",
  aspectRatios: instagramAspectRatios,
  buildProviderPayload,
  validateAsset,
}
