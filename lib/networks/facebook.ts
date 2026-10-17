import type {
  AspectRatio,
  BuildProviderPayloadParams,
  NetworkAdapter,
  NetworkAsset,
  PublicationFormat,
} from "./types"

// --- Adaptador de red (interfaz NetworkAdapter, ver lib/networks/types.ts) ---
// A diferencia de Pinterest, Facebook no exige elegir nada por publicación:
// el blogId de la marca ya está vinculado a una única Página de Facebook
// (confirmado contra la cuenta real — GET /v2/settings/brands devuelve
// networksData.facebookData con el id de esa Página), así que no hace falta
// un equivalente a boardId ni un endpoint de "listar páginas".

export const facebookAspectRatios: Partial<Record<PublicationFormat, AspectRatio>> = {
  // 1.91:1 (1200x630) — el ratio que recomienda Facebook/Open Graph para la
  // miniatura de un enlace compartido (el caso de uso de "artículos" que
  // pide el usuario). No verificado que Metricool lo exija exacto —
  // tolerante por ahora, igual que el resto de formatos no confirmados.
  FB_POST: { w: 1200, h: 630, exact: false },
}

const RATIO_TOLERANCE = 0.02

export function validateAsset(asset: NetworkAsset, format: PublicationFormat): void {
  const expected = facebookAspectRatios[format]
  if (!expected) {
    throw new Error(`Facebook no soporta el formato ${format}.`)
  }
  const actualRatio = asset.width / asset.height
  const expectedRatio = expected.w / expected.h

  if (expected.exact) {
    if (Math.abs(actualRatio - expectedRatio) > 1e-4) {
      throw new Error(
        `El asset ${asset.id} tiene ratio ${actualRatio.toFixed(4)} (${asset.width}x${asset.height}), pero ${format} en Facebook exige exactamente ${expectedRatio.toFixed(4)} (${expected.w}x${expected.h}).`
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

/**
 * `facebookData` — confirmado contra el swagger real de Metricool
 * (https://app.metricool.com/api/swagger.json, schema
 * ScheduledPostFacebookData): { type?, title?, boost?, boostPayer?,
 * boostBeneficiary? }. Los campos de `boost` son para promoción de pago
 * (Ads) — fuera de alcance de esta pasada, solo "crear publicaciones".
 */
export function buildProviderPayload({ target }: BuildProviderPayloadParams): object {
  return { type: "POST", title: target.title }
}

export const facebookAdapter: NetworkAdapter = {
  name: "facebook",
  aspectRatios: facebookAspectRatios,
  buildProviderPayload,
  validateAsset,
}
