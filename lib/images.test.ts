import sharp from "sharp"
import { describe, expect, it } from "vitest"
import { cropToRatio, generateVariants, getImageDimensions } from "./images"
import { instagramAspectRatios } from "./networks/instagram"

async function makeTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .jpeg()
    .toBuffer()
}

describe("getImageDimensions", () => {
  it("lee el ancho y alto reales de la imagen", async () => {
    const image = await makeTestImage(800, 600)
    await expect(getImageDimensions(image)).resolves.toEqual({ width: 800, height: 600 })
  })
})

describe("cropToRatio", () => {
  it("produce exactamente el tamaño pedido a partir de una imagen ya en ese ratio", async () => {
    const image = await makeTestImage(2160, 2880) // 4:5, el doble de 1080x1440
    const cropped = await cropToRatio(image, { w: 1080, h: 1440, exact: false })
    await expect(getImageDimensions(cropped)).resolves.toEqual({ width: 1080, height: 1440 })
  })

  it("recorta (no deforma) una imagen con un ratio de origen distinto", async () => {
    const image = await makeTestImage(1000, 1000) // cuadrada
    const cropped = await cropToRatio(image, { w: 1080, h: 1920, exact: true }) // 9:16
    await expect(getImageDimensions(cropped)).resolves.toEqual({ width: 1080, height: 1920 })
  })
})

describe("generateVariants", () => {
  it("genera una variante por cada formato del catálogo de ratios del adaptador", async () => {
    const image = await makeTestImage(1200, 1200)
    const variants = await generateVariants(image, instagramAspectRatios)

    expect(Object.keys(variants).sort()).toEqual(
      Object.keys(instagramAspectRatios).sort()
    )

    for (const format of Object.keys(instagramAspectRatios) as Array<
      keyof typeof instagramAspectRatios
    >) {
      const expected = instagramAspectRatios[format]
      await expect(getImageDimensions(variants[format])).resolves.toEqual({
        width: expected.w,
        height: expected.h,
      })
    }
  })
})
