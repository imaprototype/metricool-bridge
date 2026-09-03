import { del, put } from "@vercel/blob"

export interface UploadResult {
  url: string
  pathname: string
}

/**
 * Sube un archivo a Vercel Blob con acceso público — la URL resultante es
 * estable y siempre accesible, a diferencia de depender de que un archivo
 * de Google Drive esté compartido públicamente (ver ARCHITECTURE.md §1).
 */
export async function uploadAsset(
  key: string,
  data: Buffer,
  options: { contentType?: string } = {}
): Promise<UploadResult> {
  const blob = await put(key, data, {
    access: "public",
    contentType: options.contentType,
    addRandomSuffix: true,
  })
  return { url: blob.url, pathname: blob.pathname }
}

export async function deleteAsset(url: string): Promise<void> {
  await del(url)
}
