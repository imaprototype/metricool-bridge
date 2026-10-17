import { NextResponse } from "next/server"
import { backfillMissingVariants } from "@/lib/assets"

// Procesar un lote grande de imágenes (fetch del original + sharp + subida a
// Blob por cada una) puede tardar más que el límite por defecto de una
// función serverless — `limit` ya acota el trabajo por llamada, esto es
// margen extra.
export const maxDuration = 60

/**
 * Genera las variantes que le falten a imágenes ya subidas antes de que
 * existiera una red (p. ej. las ~178 imágenes que no tenían FB_POST al
 * añadir Facebook) — ver lib/assets.ts#backfillMissingVariants. Pensado
 * para llamarse varias veces con `?limit=` hasta que `remaining` sea 0.
 */
export async function POST(request: Request) {
  const limitParam = new URL(request.url).searchParams.get("limit")
  const limit = limitParam ? Number(limitParam) : undefined
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    return NextResponse.json({ error: "limit debe ser un entero positivo." }, { status: 400 })
  }

  const data = await backfillMissingVariants(limit)
  return NextResponse.json({ data })
}
