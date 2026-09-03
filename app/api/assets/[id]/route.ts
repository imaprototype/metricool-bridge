import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { archiveAsset, updateAsset } from "@/db/queries/assets"
import { getAssetWithUsages } from "@/lib/assets"

const updateAssetSchema = z.object({
  brandId: z.uuid().optional(),
  photographerId: z.uuid().nullable().optional(),
  objectType: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  productUrl: z.url().nullable().optional(),
  inspirationUrl: z.url().nullable().optional(),
  shortDescription: z.string().min(1).optional(),
  targetAudience: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/assets/[id]">) {
  const { id } = await ctx.params
  const asset = await getAssetWithUsages(id)
  if (!asset) {
    return NextResponse.json({ error: "Asset no encontrado." }, { status: 404 })
  }
  return NextResponse.json({ data: asset })
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/assets/[id]">) {
  const { id } = await ctx.params
  const body = await request.json().catch(() => undefined)
  const parsed = updateAssetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 })
  }

  const asset = await updateAsset(id, parsed.data)
  if (!asset) {
    return NextResponse.json({ error: "Asset no encontrado." }, { status: 404 })
  }
  return NextResponse.json({ data: asset })
}

/** Archiva, no borra — el blob se conserva salvo que se pida explícitamente (ver ARCHITECTURE.md §6). */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/assets/[id]">) {
  const { id } = await ctx.params
  const asset = await archiveAsset(id)
  if (!asset) {
    return NextResponse.json({ error: "Asset no encontrado." }, { status: 404 })
  }
  return NextResponse.json({ data: asset })
}
