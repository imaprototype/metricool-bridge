import { NextResponse } from "next/server"
import { z } from "zod"
import { createBrand, listBrands } from "@/db/queries/brands"

const createBrandSchema = z.object({
  name: z.string().min(1),
  instagramHandle: z.string().min(1).optional(),
  toneNotes: z.string().min(1).optional(),
  targetAudience: z.string().min(1).optional(),
})

export async function GET() {
  const brands = await listBrands()
  return NextResponse.json({ data: brands })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined)
  const parsed = createBrandSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 })
  }

  const brand = await createBrand(parsed.data)
  return NextResponse.json({ data: brand }, { status: 201 })
}
