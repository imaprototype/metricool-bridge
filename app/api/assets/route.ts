import { NextResponse } from "next/server"
import { z } from "zod"
import { listAssetsWithFilters, uploadAssets } from "@/lib/assets"

const assetMetadataSchema = z.object({
  brandId: z.uuid(),
  photographerIds: z.array(z.uuid()).optional(),
  objectType: z.string().min(1),
  productUrl: z.url().optional(),
  inspirationUrl: z.url().optional(),
  shortDescription: z.string().min(1),
  tags: z.array(z.string()).optional(),
})

const uploadPayloadSchema = z.object({
  uploadedBy: z.string().min(1),
  assets: z.array(assetMetadataSchema).min(1),
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

  if (parsed.data.assets.length !== files.length) {
    return NextResponse.json(
      {
        error: `'payload.assets' tiene ${parsed.data.assets.length} entradas pero se subieron ${files.length} archivos; deben coincidir 1 a 1 y en el mismo orden.`,
      },
      { status: 400 }
    )
  }

  const created = await uploadAssets({
    uploadedBy: parsed.data.uploadedBy,
    files,
    metadata: parsed.data.assets,
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
