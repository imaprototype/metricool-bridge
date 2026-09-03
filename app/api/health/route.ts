import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import * as instagram from "@/lib/networks/instagram"

export async function GET() {
  let databaseOk = false
  let databaseError: string | undefined
  try {
    await getDb().execute(sql`SELECT 1`)
    databaseOk = true
  } catch (err) {
    databaseError = err instanceof Error ? err.message : "error desconocido"
  }

  let metricoolOk = false
  let metricoolError: string | undefined
  try {
    // Ping de solo lectura: listar el día de hoy basta para validar el
    // token sin ningún efecto secundario.
    const now = new Date()
    await instagram.listPosts(now, now)
    metricoolOk = true
  } catch (err) {
    metricoolError = err instanceof Error ? err.message : "error desconocido"
  }

  const ok = databaseOk && metricoolOk

  return NextResponse.json(
    {
      data: {
        ok,
        checks: { database: databaseOk, metricool: metricoolOk },
        errors: { database: databaseError, metricool: metricoolError },
      },
    },
    { status: ok ? 200 : 503 }
  )
}
