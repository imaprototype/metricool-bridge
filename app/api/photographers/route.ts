import { NextResponse } from "next/server"
import { z } from "zod"
import { createPhotographer, listPhotographers } from "@/db/queries/photographers"

const createPhotographerSchema = z.object({
  name: z.string().min(1),
  instagramHandle: z.string().min(1).optional(),
})

export async function GET() {
  const photographers = await listPhotographers()
  return NextResponse.json({ data: photographers })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined)
  const parsed = createPhotographerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 })
  }

  const photographer = await createPhotographer(parsed.data)
  return NextResponse.json({ data: photographer }, { status: 201 })
}
