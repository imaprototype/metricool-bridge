import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isValidApiKey } from "./apiKey"

beforeEach(() => {
  vi.stubEnv("INTERNAL_API_KEY", "correct-key-1234567890")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("isValidApiKey", () => {
  it("acepta la clave correcta", () => {
    expect(isValidApiKey("correct-key-1234567890")).toBe(true)
  })

  it("rechaza una clave incorrecta de la misma longitud", () => {
    expect(isValidApiKey("wrong-key-1234567890zz")).toBe(false)
  })

  it("rechaza una clave de longitud distinta sin lanzar", () => {
    expect(() => isValidApiKey("corta")).not.toThrow()
    expect(isValidApiKey("corta")).toBe(false)
  })

  it("rechaza null", () => {
    expect(isValidApiKey(null)).toBe(false)
  })

  it("rechaza cuando INTERNAL_API_KEY no está configurada", () => {
    vi.stubEnv("INTERNAL_API_KEY", "")
    expect(isValidApiKey("cualquier-cosa")).toBe(false)
  })
})
