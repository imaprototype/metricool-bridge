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

  try {
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
  } catch (err) {
    // Sin este catch, cualquier error aquí se convierte en una página de
    // error HTML genérica — @vercel/blob/client intenta hacer res.json()
    // sobre eso y el navegador solo ve "Failed to retrieve the client
    // token", sin pista de la causa real.
    console.error("[/assets/upload/token]", err)
    return Response.json(
      { error: err instanceof Error ? err.message : "Error generando el token de subida." },
      { status: 400 }
    )
  }
}
