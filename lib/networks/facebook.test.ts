import { describe, expect, it } from "vitest"
import { facebookAdapter, validateAsset } from "./facebook"

describe("validateAsset", () => {
  it("acepta un FB_POST dentro de la tolerancia del ratio 1.91:1", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1200, height: 630 }, "FB_POST")
    ).not.toThrow()
  })

  it("rechaza un FB_POST muy fuera del ratio 1.91:1", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1000, height: 1000 }, "FB_POST")
    ).toThrow(/fuera de la tolerancia/)
  })

  it("rechaza un formato que Facebook no soporta", () => {
    expect(() =>
      validateAsset({ id: "a1", kind: "IMAGE", width: 1080, height: 1440 }, "FEED_POST")
    ).toThrow(/no soporta el formato/)
  })
})

describe("facebookAdapter.buildProviderPayload", () => {
  it("no exige ningún campo — el blogId ya está vinculado a una única Página", () => {
    const payload = facebookAdapter.buildProviderPayload({
      format: "FB_POST",
      target: { network: "facebook" },
    })
    expect(payload).toEqual({ type: "POST", title: undefined })
  })

  it("incluye title cuando se indica (override del link preview)", () => {
    const payload = facebookAdapter.buildProviderPayload({
      format: "FB_POST",
      target: { network: "facebook", title: "Título del artículo" },
    })
    expect(payload).toEqual({ type: "POST", title: "Título del artículo" })
  })
})
