import { NextResponse } from "next/server"
import { z } from "zod"
import { verifyPublications } from "@/lib/verify"

const verifySchema = z.object({
  from: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  to: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  network: z.string().min(1).optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined)
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 })
  }

  const result = await verifyPublications({
    from: new Date(parsed.data.from),
    to: new Date(parsed.data.to),
    network: parsed.data.network,
  })

  return NextResponse.json({ data: result })
}
