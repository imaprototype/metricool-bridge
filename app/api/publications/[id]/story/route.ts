import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createStoryForPublication } from "@/lib/publications"

const createStorySchema = z.object({
  publicationDate: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  text: z.string().optional(),
  // Si se omite, usa la portada de la ficha de la publicación origen.
  imageIds: z.array(z.uuid()).optional(),
})

export async function POST(request: NextRequest, ctx: RouteContext<"/api/publications/[id]/story">) {
  const { id } = await ctx.params
  const body = await request.json().catch(() => undefined)
  const parsed = createStorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 })
  }

  try {
    const story = await createStoryForPublication(id, {
      publicationDate: new Date(parsed.data.publicationDate),
      text: parsed.data.text,
      imageIds: parsed.data.imageIds,
    })
    return NextResponse.json({ data: story }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error creando la story." },
      { status: 400 }
    )
  }
}
