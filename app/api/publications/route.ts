import { NextResponse } from "next/server"
import { z } from "zod"
import { createPublication, listPublicationsWithTargets } from "@/lib/publications"

const targetSchema = z.object({
  network: z.string().min(1),
  collaborators: z.array(z.string()).optional(),
})

const createPublicationSchema = z.object({
  format: z.enum(["FEED_POST", "CAROUSEL", "STORY", "REEL", "VIDEO_POST"]),
  assetIds: z.array(z.uuid()).min(1),
  text: z.string(),
  publicationDate: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  targets: z.array(targetSchema).min(1),
})

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const data = await listPublicationsWithTargets({
    from: parseDateParam(params.get("from")),
    to: parseDateParam(params.get("to")),
    network: params.get("network") ?? undefined,
  })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined)
  const parsed = createPublicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 })
  }

  try {
    const publication = await createPublication({
      format: parsed.data.format,
      assetIds: parsed.data.assetIds,
      text: parsed.data.text,
      publicationDate: new Date(parsed.data.publicationDate),
      targets: parsed.data.targets,
    })
    return NextResponse.json({ data: publication }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error creando la publicación." },
      { status: 400 }
    )
  }
}
