import { defineConfig } from "drizzle-kit"

if (!process.env.DATABASE_URL) {
  throw new Error("Falta la variable de entorno DATABASE_URL.")
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
