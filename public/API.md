# NØRU × Metricool Bridge — Referencia de API

**Última actualización:** 2026-09-09

> ⚠️ **`POST /api/assets` tiene un límite de ~4.5MB por request** (tope duro de infraestructura de Vercel Functions, no configurable). Con varios archivos o vídeo es fácil superarlo. El formulario web `/assets/upload` ya no tiene este límite (sube directo a Blob desde el navegador), pero este endpoint externo, de momento, sí. Ver Changelog.

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

Un **Asset es una ficha de producto/contenido**, no un archivo — puede tener **una o varias imágenes** (`images[]`), todas compartiendo la misma metadata (marca, fotógrafos, descripción, tags...). Pertenece a **una sola marca** (`brandId`) pero puede tener **0 o varios fotógrafos** (`photographerIds`, array).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/assets?brand=&objectType=&photographer=&tag=&kind=IMAGE\|VIDEO&unusedSince=&neverUsed=true&page=&pageSize=` | Lista con filtros, paginado, incluye `images[]` y `usages[]` por ficha |
| GET | `/api/assets/:id` | Detalle + `images[]` + `usages[]` |
| POST | `/api/assets` | Crea **una** ficha con una o varias imágenes (`multipart/form-data`) |
| PATCH | `/api/assets/:id` | `{ objectType?, brandId?, photographerIds?, productUrl?, inspirationUrl?, shortDescription?, tags? }` — metadata de la ficha, no toca sus imágenes |
| DELETE | `/api/assets/:id` | **Archiva**, no borra el blob |

`?photographer=<uuid>` en el GET filtra por "este fotógrafo está entre los de la ficha". El conjunto de imágenes de una ficha queda fijo al crearla — no hay endpoint para añadir/quitar imágenes de una ficha existente todavía; para eso, crea una ficha nueva.

### `POST /api/assets`

Campos del `multipart/form-data`:

- `files`: uno o varios archivos, **todos de la misma ficha y del mismo tipo** (todo imágenes o todo vídeo — mezclar da 400)
- `payload`: string JSON con la metadata **compartida por todos los archivos**:

```json
{
  "uploadedBy": "tu-email",
  "brandId": "uuid",
  "photographerIds": ["uuid", "... (opcional, 0 o varios)"],
  "objectType": "lámpara de mesa",
  "productUrl": "https://... (opcional)",
  "inspirationUrl": "https://... (opcional, post de referencia)",
  "shortDescription": "para que la IA redacte el copy",
  "tags": ["opcional", "array"]
}
```

Para varias fichas distintas, varias llamadas — un `POST` siempre crea exactamente una ficha.

Cada archivo genera automáticamente sus variantes recortadas por formato (`FEED_POST`, `CAROUSEL`, `STORY`, `REEL`, `VIDEO_POST` para imágenes; solo `thumbnail` para vídeo — **los vídeos aún no se pueden usar en `/api/publications` hasta que se generen sus variantes por formato**, limitación conocida). El orden de `files` en la request es el orden final de `images[]`: la **primera imagen es la portada** (la que se usa por defecto al publicar).

## Publicaciones

Una publicación referencia **una sola ficha** (`assetId`). Para formatos de una imagen usa su portada por defecto; para `CAROUSEL`, todas sus imágenes en orden — salvo que indiques `imageIds` explícitamente.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/publications?from=&to=&network=` | Lista en rango de fechas (ISO), filtro opcional por red |
| POST | `/api/publications` | Crea y publica/programa en Metricool de verdad |
| PATCH | `/api/publications/:id` | Edita texto/ficha/fecha — hace PUT real en Metricool |
| DELETE | `/api/publications/:id` | Borra en Metricool y en el registro interno |
| POST | `/api/publications/:id/story` | Crea una Story asociada, reutilizando la ficha de la publicación origen |
| POST | `/api/verify` | `{ from, to, network? }` — re-consulta Metricool y devuelve drift detectado |

### `POST /api/publications`

```json
{
  "format": "FEED_POST | CAROUSEL | STORY | REEL | VIDEO_POST",
  "assetId": "uuid",
  "imageIds": ["uuid", "... (opcional — por defecto: portada para 1 imagen, todas para CAROUSEL)"],
  "text": "texto del post",
  "publicationDate": "2026-09-10T18:00:00.000Z",
  "timezone": "Europe/Madrid",
  "targets": [{ "network": "instagram", "collaborators": ["handle_opcional"] }]
}
```

- `publicationDate` va como ISO string en la request (la API lo convierte internamente al formato que exige Metricool). `timezone` es opcional, por defecto `Europe/Madrid`.
- `imageIds`, si se indica, debe resolver a **exactamente 1 imagen** para formatos que no sean `CAROUSEL` (400 si no).
- Un `CAROUSEL` **no puede combinar imágenes de fichas distintas** — todas vienen de la `assetId` indicada.
- Cada imagen usada debe tener ya generada la variante del `format` pedido (se genera sola al subir).
- Hoy solo `"instagram"` está implementado como red real.

### `POST /api/publications/:id/story`

```json
{
  "publicationDate": "2026-09-10T20:00:00.000Z",
  "text": "opcional",
  "imageIds": ["opcional — por defecto la portada de la ficha origen"]
}
```

## Notas

- Todo lo anterior está **verificado contra la cuenta real de Metricool/Instagram**, no solo con mocks — incluyendo la creación, edición (con rotación de `id`) y borrado de publicaciones, y el flujo de ficha con varias imágenes (FEED_POST con portada + CAROUSEL con todas).
- `DELETE /api/assets/:id` archiva; no hay borrado duro de assets expuesto por API todavía.
- Para saber si un asset lleva tiempo sin usarse antes de proponerlo, usa `neverUsed=true` o `unusedSince=<fecha>` en `GET /api/assets`.

## Changelog

- **2026-09-09** — El formulario web `/assets/upload` ahora sube los originales directo a Vercel Blob desde el navegador (sin pasar por una Function), así que ya no tiene límite de tamaño práctico. `POST /api/assets` **no ha cambiado** y sigue teniendo el tope duro de ~4.5MB por request de las Vercel Functions — pendiente de resolver para este endpoint.
- **2026-09-09** — Cambio de modelo importante: **Asset pasa a ser una ficha con una o varias imágenes** (`images[]`), no un archivo suelto. `POST /api/assets` ahora crea una ficha por llamada (`payload` es un objeto único, ya no un array por archivo). `POST/PATCH /api/publications` y `POST /api/publications/:id/story` cambian `assetIds`→`assetId` (una sola ficha) + `imageIds?` opcional (portada por defecto, todas para CAROUSEL). Un CAROUSEL ya no puede combinar imágenes de fichas distintas.
- **2026-09-06** — Assets: quitados `category` y `targetAudience` (ya no existen en el modelo). `photographerId` (uno) pasa a `photographerIds` (array, 0 o varios). `PATCH /api/assets/:id` ahora también acepta `brandId` y `photographerIds`.
- **2026-09-03** — Primera versión: catálogos, assets, publicaciones, verify. Todo verificado contra Metricool/Instagram real (incluye el descubrimiento de que `publicationDate` va como `{ dateTime, timezone }`, no un string ISO plano, y que Metricool rota el `id` de un post en cada `PUT`).
