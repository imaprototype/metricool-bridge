import { buildUrl, metricoolFetch, unwrap } from "./metricool-client"
import type {
  AspectRatio,
  BuildProviderPayloadParams,
  NetworkAdapter,
  NetworkAsset,
  PublicationFormat,
} from "./types"

// --- Adaptador de red (interfaz NetworkAdapter, ver lib/networks/types.ts) ---

export const pinterestAspectRatios: Partial<Record<PublicationFormat, AspectRatio>> = {
  // 2:3 recomendado por Pinterest. No verificado que Metricool lo exija
  // exacto (a diferencia de Stories en Instagram) — tolerante por ahora,
  // ajustar si lo rechaza en la práctica.
  PIN: { w: 1000, h: 1500, exact: false },
}

const RATIO_TOLERANCE = 0.02

export function validateAsset(asset: NetworkAsset, format: PublicationFormat): void {
  const expected = pinterestAspectRatios[format]
  if (!expected) {
    throw new Error(`Pinterest no soporta el formato ${format}.`)
  }
  const actualRatio = asset.width / asset.height
  const expectedRatio = expected.w / expected.h

  if (expected.exact) {
    if (Math.abs(actualRatio - expectedRatio) > 1e-4) {
      throw new Error(
        `El asset ${asset.id} tiene ratio ${actualRatio.toFixed(4)} (${asset.width}x${asset.height}), pero ${format} en Pinterest exige exactamente ${expectedRatio.toFixed(4)} (${expected.w}x${expected.h}).`
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
 * `pinterestData` — confirmado contra el swagger real de Metricool
 * (https://app.metricool.com/api/swagger.json, schema
 * ScheduledPostPinterestData): { boardId, pinTitle?, pinLink?, pinNewFormat? }.
 * boardId es obligatorio — sin él Metricool no sabe en qué tablero crear el Pin.
 */
export function buildProviderPayload({ target }: BuildProviderPayloadParams): object {
  if (!target.boardId) {
    throw new Error("Pinterest requiere boardId en el target (ver GET /api/pinterest/boards).")
  }
  return {
    boardId: target.boardId,
    pinTitle: target.pinTitle,
    pinLink: target.pinLink,
  }
}

export const pinterestAdapter: NetworkAdapter = {
  name: "pinterest",
  aspectRatios: pinterestAspectRatios,
  buildProviderPayload,
  validateAsset,
}

// --- Boards — Pinterest, a diferencia de Instagram, exige elegir un tablero al publicar ---

export interface PinterestBoard {
  id: string
  name: string
  description?: string
  privacy?: string
}

/** Confirmado contra la cuenta real conectada (GET /v2/scheduler/boards/pinterest). */
export async function listBoards(): Promise<PinterestBoard[]> {
  const res = await metricoolFetch(buildUrl("/v2/scheduler/boards/pinterest"))
  return unwrap<PinterestBoard[]>(res)
}
