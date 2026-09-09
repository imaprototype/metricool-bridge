import { NextResponse } from "next/server"
import { z } from "zod"
import { listAssetsWithFilters, uploadAsset } from "@/lib/assets"

const uploadPayloadSchema = z.object({
  uploadedBy: z.string().min(1),
  brandId: z.uuid(),
  photographerIds: z.array(z.uuid()).optional(),
  objectType: z.string().min(1),
  productUrl: z.url().optional(),
  inspirationUrl: z.url().optional(),
  shortDescription: z.string().min(1),
  tags: z.array(z.string()).optional(),
})

function parseIntParam(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const kindParam = params.get("kind")

  const result = await listAssetsWithFilters({
    brandId: params.get("brand") ?? undefined,
    objectType: params.get("objectType") ?? undefined,
    photographerId: params.get("photographer") ?? undefined,
    tag: params.get("tag") ?? undefined,
    kind: kindParam === "IMAGE" || kindParam === "VIDEO" ? kindParam : undefined,
    unusedSince: parseDateParam(params.get("unusedSince")),
    neverUsed: params.get("neverUsed") === "true",
    page: parseIntParam(params.get("page")),
    pageSize: parseIntParam(params.get("pageSize")),
  })

  return NextResponse.json(result)
}

/**
 * Crea UNA ficha con una o varias imágenes — todos los `files` comparten la
 * misma metadata de `payload`. Para varias fichas distintas, varias llamadas.
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File)
  const payloadRaw = formData.get("payload")

  if (files.length === 0) {
    return NextResponse.json({ error: "No se ha subido ningún archivo (campo 'files')." }, { status: 400 })
  }
  if (typeof payloadRaw !== "string") {
    return NextResponse.json({ error: "Falta el campo 'payload' (JSON)." }, { status: 400 })
  }

  let payloadJson: unknown
  try {
    payloadJson = JSON.parse(payloadRaw)
  } catch {
    return NextResponse.json({ error: "El campo 'payload' no es JSON válido." }, { status: 400 })
  }

  const parsed = uploadPayloadSchema.safeParse(payloadJson)
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 })
  }

  try {
    const created = await uploadAsset({
      uploadedBy: parsed.data.uploadedBy,
      files,
      metadata: {
        brandId: parsed.data.brandId,
        photographerIds: parsed.data.photographerIds,
        objectType: parsed.data.objectType,
        productUrl: parsed.data.productUrl,
        inspirationUrl: parsed.data.inspirationUrl,
        shortDescription: parsed.data.shortDescription,
        tags: parsed.data.tags,
      },
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error subiendo la ficha." },
      { status: 400 }
    )
  }
}
