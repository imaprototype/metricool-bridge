import { timingSafeEqual } from "node:crypto"

/**
 * Auth de la API propia (header `x-api-key`, ver ARCHITECTURE.md §2/§8).
 * Vive en su propio módulo (no en lib/auth.ts) para no arrastrar el import
 * de next-auth/next-server al testear esta función pura — ese import solo
 * resuelve bien bajo el bundler de Next, no bajo Vitest.
 */
export function isValidApiKey(providedKey: string | null): boolean {
  const expectedKey = process.env.INTERNAL_API_KEY
  if (!expectedKey || !providedKey) return false

  const expected = Buffer.from(expectedKey)
  const provided = Buffer.from(providedKey)
  if (expected.length !== provided.length) return false

  return timingSafeEqual(expected, provided)
}
