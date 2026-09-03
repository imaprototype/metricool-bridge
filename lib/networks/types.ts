export type PublicationFormat =
  | "FEED_POST"
  | "CAROUSEL"
  | "STORY"
  | "REEL"
  | "VIDEO_POST"

export interface AspectRatio {
  w: number
  h: number
  /** Si true, Metricool rechaza cualquier desviación del ratio (p. ej. Stories 9:16). */
  exact: boolean
}

/**
 * Subconjunto de `Asset` (ver ARCHITECTURE.md §3) que necesita la capa de
 * adaptadores para validar dimensiones. No depende del schema de Drizzle
 * (Fase 3) a propósito, para que Fase 1 no quede acoplada a un modelo de
 * datos que todavía no existe.
 */
export interface NetworkAsset {
  id: string
  kind: "IMAGE" | "VIDEO"
  width: number
  height: number
}

/**
 * Subconjunto de `PublicationTarget` (ver ARCHITECTURE.md §3) relevante para
 * construir el bloque de payload específico de una red.
 */
export interface PublicationTarget {
  network: string
  metricoolId?: number
  collaborators?: string[]
  status?: "PENDING" | "PUBLISHED" | "ERROR"
}

export interface BuildProviderPayloadParams {
  format: PublicationFormat
  target: PublicationTarget
}

/**
 * Interfaz que implementa cada red soportada (ver ARCHITECTURE.md §5).
 * `buildProviderPayload` construye solo el bloque `<red>Data` que Metricool
 * espera para esa red — campos a nivel raíz del post (como `collaborators`
 * o el `autoPublish` de las Stories) son responsabilidad de quien orquesta
 * la llamada completa (Fase 6), no del adaptador.
 */
export interface NetworkAdapter {
  name: string
  aspectRatios: Record<PublicationFormat, AspectRatio>
  buildProviderPayload(params: BuildProviderPayloadParams): object
  validateAsset(asset: NetworkAsset, format: PublicationFormat): void
}
