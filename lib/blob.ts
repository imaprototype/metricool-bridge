import { del, put } from "@vercel/blob"

export interface UploadResult {
  url: string
  pathname: string
}

/**
 * Sube un archivo a Vercel Blob con acceso público — la URL resultante es
 * estable y siempre accesible, a diferencia de depender de que un archivo
 * de Google Drive esté compartido públicamente (ver ARCHITECTURE.md §1).
 *
 * Se pasa `token` explícito (en vez de dejar que el SDK lo resuelva solo)
 * porque, si además de BLOB_READ_WRITE_TOKEN están presentes
 * VERCEL_OIDC_TOKEN y BLOB_STORE_ID en el entorno (los inyecta
 * `vercel env pull`), el SDK prioriza auth por OIDC — y esta falla con
 * "OIDC is enabled for this project, but not for the development
 * environment" en local. Pasar `token` explícito gana siempre sobre esa
 * detección (ver resolveBlobAuth en @vercel/blob).
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
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return { url: blob.url, pathname: blob.pathname }
}

export async function deleteAsset(url: string): Promise<void> {
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })
}
