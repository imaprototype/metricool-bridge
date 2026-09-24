import { NextResponse } from "next/server"
import { listBoards } from "@/lib/networks/pinterest"

export async function GET() {
  const data = await listBoards()
  return NextResponse.json({ data })
}
