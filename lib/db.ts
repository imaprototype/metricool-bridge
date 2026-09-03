import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "@/db/schema"

export type Db = ReturnType<typeof drizzle<typeof schema>>

let instance: Db | undefined

/** Cliente perezoso: no valida DATABASE_URL hasta la primera consulta real. */
export function getDb(): Db {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("Falta la variable de entorno DATABASE_URL.")
    }
    instance = drizzle(neon(connectionString), { schema })
  }
  return instance
}
