import sharp from "sharp"
import type { AspectRatio, PublicationFormat } from "./networks/types"

export interface ImageDimensions {
  width: number
  height: number
}

export async function getImageDimensions(input: Buffer): Promise<ImageDimensions> {
  const metadata = await sharp(input).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error("No se pudieron leer las dimensiones de la imagen.")
  }
  return { width: metadata.width, height: metadata.height }
}

/**
 * Recorta y redimensiona una imagen a un ratio exacto en píxeles, con
 * recorte centrado ("cover"). El resultado siempre mide exactamente
 * `ratio.w x ratio.h` — necesario para que las Stories (9:16 exacto en
 * Instagram, ver lib/networks/instagram.ts) pasen `validateAsset()`.
 */
export async function cropToRatio(input: Buffer, ratio: AspectRatio): Promise<Buffer> {
  return sharp(input)
    .rotate() // respeta la orientación EXIF antes de recortar
    .resize(ratio.w, ratio.h, { fit: "cover", position: "centre" })
    .toBuffer()
}

/**
 * Genera una variante por cada formato del catálogo `aspectRatios` de un
 * adaptador de red (ver lib/networks/types.ts). Pensado para llamarse una
 * vez por imagen subida, con `adapter.aspectRatios` del adaptador que
 * corresponda — así el pipeline no queda hardcodeado a Instagram.
 */
export async function generateVariants(
  input: Buffer,
  aspectRatios: Record<PublicationFormat, AspectRatio>
): Promise<Record<PublicationFormat, Buffer>> {
  const formats = Object.keys(aspectRatios) as PublicationFormat[]
  const buffers = await Promise.all(formats.map((format) => cropToRatio(input, aspectRatios[format])))

  return Object.fromEntries(formats.map((format, i) => [format, buffers[i]])) as Record<
    PublicationFormat,
    Buffer
  >
}
