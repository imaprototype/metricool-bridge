import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

/**
 * Emite el token que permite al navegador subir directo a Vercel Blob,
 * saltándose el tope duro de 4.5MB de las Vercel Functions (ver
 * ARCHITECTURE.md / plan de subida directa). Deliberadamente FUERA de
 * app/api/ — así queda bajo el matcher /assets/:path* de proxy.ts,
 * protegida por sesión (no por x-api-key: el navegador no debe tener la
 * INTERNAL_API_KEY).
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody

  const jsonResponse = await handleUpload({
    body,
    request,
    // Mismo motivo que en lib/blob.ts: evita que el SDK prefiera auth OIDC.
    token: process.env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ["image/*", "video/*"],
      addRandomSuffix: true,
      maximumSizeInBytes: 500 * 1024 * 1024,
    }),
  })

  return Response.json(jsonResponse)
}
