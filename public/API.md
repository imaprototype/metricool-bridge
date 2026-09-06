# NØRU × Metricool Bridge — Referencia de API

**Última actualización:** 2026-09-06

**Base URL:** `https://metricool-bridge.vercel.app`

**Auth:** header `x-api-key: <INTERNAL_API_KEY>` en todas las rutas `/api/*` excepto `/api/health`. Sin la clave o con una incorrecta → `401`.

Respuestas: éxito envuelto en `{ "data": ... }`, error en `{ "error": ... }` (string o árbol de validación de zod).

> Este documento se sirve tal cual en `/API.md` — conviene consultarlo de vez en cuando antes de construir integraciones nuevas contra este bridge, ya que el modelo de datos puede cambiar. Ver el Changelog al final.

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
| GET | `/api/assets?brand=&objectType=&photographer=&tag=&kind=IMAGE\|VIDEO&unusedSince=&neverUsed=true&page=&pageSize=` | Lista con filtros, paginado, incluye historial de uso por asset |
| GET | `/api/assets/:id` | Detalle + `usages` |
| POST | `/api/assets` | Sube uno o varios (`multipart/form-data`) |
| PATCH | `/api/assets/:id` | `{ objectType?, brandId?, photographerIds?, productUrl?, inspirationUrl?, shortDescription?, tags? }` |
| DELETE | `/api/assets/:id` | **Archiva**, no borra el blob |

Un asset pertenece a **una sola marca** (`brandId`) pero puede tener **0 o varios fotógrafos** (`photographerIds`, array). `?photographer=<uuid>` en el GET filtra por "este fotógrafo está entre los del asset".

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
      "photographerIds": ["uuid", "... (opcional, 0 o varios)"],
      "objectType": "lámpara de mesa",
      "productUrl": "https://... (opcional)",
      "inspirationUrl": "https://... (opcional, post de referencia)",
      "shortDescription": "para que la IA redacte el copy",
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

## Changelog

- **2026-09-06** — Assets: quitados `category` y `targetAudience` (ya no existen en el modelo). `photographerId` (uno) pasa a `photographerIds` (array, 0 o varios). `PATCH /api/assets/:id` ahora también acepta `brandId` y `photographerIds`.
- **2026-09-03** — Primera versión: catálogos, assets, publicaciones, verify. Todo verificado contra Metricool/Instagram real (incluye el descubrimiento de que `publicationDate` va como `{ dateTime, timezone }`, no un string ISO plano, y que Metricool rota el `id` de un post en cada `PUT`).
