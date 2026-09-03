import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { deletePublication, updatePublication } from "@/lib/publications"

const updatePublicationSchema = z.object({
  text: z.string().optional(),
  assetIds: z.array(z.uuid()).min(1).optional(),
  publicationDate: z
    .iso.datetime({ offset: true })
    .or(z.iso.datetime())
    .optional(),
})

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/publications/[id]">) {
  const { id } = await ctx.params
  const body = await request.json().catch(() => undefined)
  const parsed = updatePublicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 })
  }

  try {
    const publication = await updatePublication(id, {
      text: parsed.data.text,
      assetIds: parsed.data.assetIds,
      publicationDate: parsed.data.publicationDate ? new Date(parsed.data.publicationDate) : undefined,
    })
    if (!publication) {
      return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 })
    }
    return NextResponse.json({ data: publication })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error actualizando la publicación." },
      { status: 400 }
    )
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/publications/[id]">) {
  const { id } = await ctx.params
  try {
    const deleted = await deletePublication(id)
    if (!deleted) {
      return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 })
    }
    return NextResponse.json({ data: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error borrando la publicación." },
      { status: 400 }
    )
  }
}
