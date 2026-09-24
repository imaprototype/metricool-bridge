import { describe, expect, it } from "vitest"
import { instagramAdapter, validateAsset } from "./instagram"

describe("validateAsset", () => {
  it("acepta un Story exactamente 9:16", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1920 }, "STORY")
    ).not.toThrow()
  })

  it("rechaza un Story que no sea exactamente 9:16", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1350 }, "STORY")
    ).toThrow(/exige exactamente/)
  })

  it("acepta un feed post dentro de la tolerancia de ratio", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1440 }, "FEED_POST")
    ).not.toThrow()
  })

  it("rechaza un feed post muy fuera del ratio 4:5", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1080 }, "FEED_POST")
    ).toThrow(/fuera de la tolerancia/)
  })

  it("rechaza un formato que Instagram no soporta", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1000, height: 1500 }, "PIN")
    ).toThrow(/no soporta el formato/)
  })
})

describe("instagramAdapter.buildProviderPayload", () => {
  it("marca type STORY y autoPublish para Stories", () => {
    const payload = instagramAdapter.buildProviderPayload({
      format: "STORY",
      target: { network: "instagram" },
    })
    expect(payload).toEqual({ type: "STORY", autoPublish: true })
  })

  it("marca type POST para el resto de formatos", () => {
    const payload = instagramAdapter.buildProviderPayload({
      format: "FEED_POST",
      target: { network: "instagram" },
    })
    expect(payload).toEqual({ type: "POST" })
  })
})
