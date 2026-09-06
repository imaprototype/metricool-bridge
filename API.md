# NØRU × Metricool Bridge — Referencia de API

**Base URL:** `https://metricool-bridge.vercel.app`

**Auth:** header `x-api-key: <INTERNAL_API_KEY>` en todas las rutas `/api/*` excepto `/api/health`. Sin la clave o con una incorrecta → `401`.

Respuestas: éxito envuelto en `{ "data": ... }`, error en `{ "error": ... }` (string o árbol de validación de zod).

## Salud

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/health` | no | `{ data: { ok, checks: {database, metricool}, errors } }` — `200` si todo ok, `503` si algo falla |

## Catálogos

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/brands` | — | Lista marcas |
| POST | `/api/brands` | `{ name, instagramHandle?, toneNotes?, targetAudience? }` | Crea marca |
| GET | `/api/photographers` | — | Lista fotógrafos |
| POST | `/api/photographers` | `{ name, instagramHandle? }` | Crea fotógrafo |

## Assets

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/assets?brand=&category=&objectType=&photographer=&tag=&kind=IMAGE\|VIDEO&unusedSince=&neverUsed=true&page=&pageSize=` | Lista con filtros, paginado, incluye historial de uso por asset |
| GET | `/api/assets/:id` | Detalle + `usages` |
| POST | `/api/assets` | Sube uno o varios (`multipart/form-data`) |
| PATCH | `/api/assets/:id` | `{ objectType?, category?, productUrl?, inspirationUrl?, shortDescription?, targetAudience?, tags? }` |
| DELETE | `/api/assets/:id` | **Archiva**, no borra el blob |

### `POST /api/assets`

Campos del `multipart/form-data`:

- `files`: uno o varios archivos (repetir el campo `files` por cada uno)
- `payload`: string JSON, con una entrada por archivo en el mismo orden:

```json
{
  "uploadedBy": "tu-email",
  "assets": [
    {
      "brandId": "uuid",
      "photographerId": "uuid (opcional)",
      "objectType": "lámpara de mesa",
      "category": "iluminación",
      "productUrl": "https://... (opcional)",
      "inspirationUrl": "https://... (opcional, post de referencia)",
      "shortDescription": "para que la IA redacte el copy",
      "targetAudience": "opcional",
      "tags": ["opcional", "array"]
    }
  ]
}
```

Al subir, genera automáticamente variantes recortadas por formato (`FEED_POST`, `CAROUSEL`, `STORY`, `REEL`, `VIDEO_POST` para imágenes; solo `thumbnail` para vídeo — **los vídeos aún no se pueden usar en `/api/publications` hasta que se generen sus variantes por formato**, limitación conocida).

## Publicaciones

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/publications?from=&to=&network=` | Lista en rango de fechas (ISO), filtro opcional por red |
| POST | `/api/publications` | Crea y publica/programa en Metricool de verdad |
| PATCH | `/api/publications/:id` | Edita texto/assets/fecha — hace PUT real en Metricool |
| DELETE | `/api/publications/:id` | Borra en Metricool y en el registro interno |
| POST | `/api/publications/:id/story` | Crea una Story asociada, reutilizando assets de la publicación origen |
| POST | `/api/verify` | `{ from, to, network? }` — re-consulta Metricool y devuelve drift detectado |

### `POST /api/publications`

```json
{
  "format": "FEED_POST | CAROUSEL | STORY | REEL | VIDEO_POST",
  "assetIds": ["uuid", "..."],
  "text": "texto del post",
  "publicationDate": "2026-09-10T18:00:00.000Z",
  "timezone": "Europe/Madrid",
  "targets": [{ "network": "instagram", "collaborators": ["handle_opcional"] }]
}
```

- `publicationDate` va como ISO string en la request (la API lo convierte internamente al formato que exige Metricool). `timezone` es opcional, por defecto `Europe/Madrid`.
- Cada asset debe tener ya generada la variante del `format` pedido (se genera sola al subir la imagen).
- Hoy solo `"instagram"` está implementado como red real.

### `POST /api/publications/:id/story`

```json
{
  "publicationDate": "2026-09-10T20:00:00.000Z",
  "text": "opcional",
  "assetIds": ["opcional, reutiliza los del origen si se omite"]
}
```

## Notas

- Todo lo anterior está **verificado contra la cuenta real de Metricool/Instagram**, no solo con mocks — incluyendo la creación, edición (con rotación de `id`) y borrado de publicaciones.
- `DELETE /api/assets/:id` archiva; no hay borrado duro de assets expuesto por API todavía.
- Para saber si un asset lleva tiempo sin usarse antes de proponerlo, usa `neverUsed=true` o `unusedSince=<fecha>` en `GET /api/assets`.
