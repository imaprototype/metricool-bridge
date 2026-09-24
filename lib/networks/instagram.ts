import type {
  AspectRatio,
  BuildProviderPayloadParams,
  NetworkAdapter,
  NetworkAsset,
  PublicationFormat,
} from "./types"

// --- Adaptador de red (interfaz NetworkAdapter, ver lib/networks/types.ts) ---
// El cliente HTTP genérico de Metricool (createPost, normalizeImageUrl,
// toMetricoolDateTimeInfo...) vive en ./metricool-client — no es específico
// de Instagram, lo comparten todas las redes registradas.

export const instagramAspectRatios: Partial<Record<PublicationFormat, AspectRatio>> = {
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
  if (!expected) {
    throw new Error(`Instagram no soporta el formato ${format}.`)
  }
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
