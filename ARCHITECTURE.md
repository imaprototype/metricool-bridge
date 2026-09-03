# NØRU × Metricool Bridge — Arquitectura y plan de construcción

Documento de referencia para construir, con el agente de Claude Code en VS Code, una API propia desplegada en Vercel que actúe como intermediaria entre Claude y Metricool, con un gestor de assets (DAM) propio y diseño preparado para publicar en varias redes sociales, no solo Instagram.

**v4** — añade el gestor de assets con metadata enriquecida (ahora con `productUrl`), la capa de adaptadores multi-red, y fija el stack en Next.js 16 + shadcn/ui para la UI. Sustituye a la versión anterior; cópialo entero sobre el `ARCHITECTURE.md` que ya tengas en el repo.

## 1. Por qué esto y no seguir como hasta ahora

Esta sesión programando posts a mano vía API dejó claros varios puntos de fricción que una API propia elimina de raíz:

- **Sin salida de red directa a Metricool.** El entorno donde corre Claude no tiene acceso a `app.metricool.com`, así que cada llamada tiene que tunelizarse a través de una pestaña de Chrome real. Una API en Vercel es un host HTTPS normal, alcanzable directamente.
- **Reescalado silencioso.** Metricool reagenda (a veces incluso re-fecha) posts pendientes por su cuenta tras un `PUT`. Hoy lo detectamos re-consultando a mano después de cada tanda de cambios. La API propia puede hacer esa verificación automáticamente y guardar un registro de cuándo ha ocurrido.
- **Rotación de ID en cada `PUT`.** Metricool no actualiza en sitio: internamente borra el post y crea uno nuevo con otro ID. Cualquier cosa que dependa de "el ID de este post" se rompe si no se sigue el rastro. Esto debe vivir escondido detrás de un ID propio y estable.
- **Gestión de imágenes frágil.** Hoy dependemos de que un archivo de Google Drive esté compartido públicamente para poder normalizarlo en Metricool, con truco de `lh3.googleusercontent.com` incluido cuando falla. Un storage propio (Vercel Blob) con URLs siempre públicas por diseño quita ese problema.
- **Assets sin contexto.** Hoy exploro un directorio de archivos y adivino de qué producto se trata por el nombre del fichero. No sé la marca, el fotógrafo, la categoría, el público objetivo, ni si esa foto ya se usó antes. Toda esa información vive solo en tu cabeza — necesito poder consultarla para escribir mejor copy y para no repetir material.
- **Reglas de negocio que hoy vivo yo re-derivando cada vez**: el ratio de recorte del feed, el ratio exacto 9:16 de las Stories, la forma exacta del payload de `collaborators`, la cadencia de publicación. Todo eso debería vivir codificado una vez en el backend, no reinventado en cada sesión de chat.

## 2. Decisión de arquitectura

**Seguimos con una API REST simple** (no MCP todavía — ver documento anterior para el porqué), ahora ampliada en dos direcciones:

1. **Gestor de assets propio (DAM)**: una interfaz web para subir fotos/vídeos con su metadata, y un endpoint que yo consulto para traerme assets con contexto, en vez de explorar un directorio a ciegas.
2. **Núcleo agnóstico de red social**: aunque hoy solo publicamos en Instagram, el modelo de datos y los endpoints no asumen Instagram como única red. Dato a favor: **Metricool ya es en sí mismo un programador multi-red** (Instagram, X/Twitter, LinkedIn, Facebook, TikTok, Pinterest...) — el campo `providers` de su API ya está pensado como una lista. Lo único que hace falta es que nuestro propio modelo no cablee "Instagram" a fuego, y que cada red tenga su propio adaptador para las peculiaridades que vayamos descubriendo (como ya descubrimos las de Instagram esta sesión).

**Stack** (sin cambios respecto a la versión anterior, misma tabla):

| Pieza | Elección | Motivo |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript | Route Handlers = API serverless nativa en Vercel; además sirve directamente la UI web del gestor de assets sin proyecto aparte |
| UI del gestor de assets | shadcn/ui (Radix primitives + Tailwind) | Componentes copiados al repo (no es una dependencia de npm cerrada) — grid de assets, formulario de subida, `Dialog`/`Sheet` para edición de metadata, todo con estilo consistente y accesible de fábrica |
| Validación | `zod` | Falla rápido y claro en payloads mal formados |
| Imágenes/vídeo | `sharp` (recorte/resize de imagen) + `ffmpeg` vía `@ffmpeg-installer/ffmpeg` (miniaturas de vídeo) + Vercel Blob (storage) | Recorte exacto por red, en servidor; Blob da URL pública estable sin depender de Drive |
| Persistencia | Vercel Postgres (o Neon) vía `drizzle` | Mapeo de IDs de Metricool + ahora también el catálogo de assets, marcas y fotógrafos |
| Auth de la API | Header `x-api-key` propio | La API queda expuesta en internet; no debe ser invocable por cualquiera |
| Auth de la UI web | Login simple (magic link o usuario/contraseña con `next-auth`) | Solo tú (y quien tú decidas) sube assets; no hace falta nada más sofisticado para un equipo de una persona |
| Cliente Metricool | Módulo propio (`lib/networks/instagram.ts` dentro de la capa de adaptadores, ver §5) | La API pública de Metricool es pequeña; un wrapper tipado es más fiable que un paquete no oficial |

## 3. Modelo de dominio

```
Brand
  id                  uuid
  name                string            // "NØRU", "Santa & Cole"...
  instagramHandle     string?
  toneNotes           text?             // resumen de tono de marca para guiar a la IA
  targetAudience      text?             // público objetivo por defecto de la marca
  createdAt           datetime

Photographer
  id                  uuid
  name                string
  instagramHandle     string?
  createdAt           datetime

Asset
  id                  uuid
  kind                "IMAGE" | "VIDEO"
  originalBlobUrl     string            // archivo tal cual se subió
  variants            json              // { feed: url, story: url, square: url, ... } generadas al subir
  brandId             uuid              // FK a Brand
  photographerId      uuid?             // FK a Photographer
  objectType           string           // "lámpara de mesa", "silla"...
  category            string            // "iluminación", "mobiliario", "textil"...
  productUrl           string?           // ficha del producto (tienda, web de la marca...) — para CTA y contexto de la IA
  inspirationUrl       string?           // post de referencia (Instagram u otra red) con buen engagement, para orientar el enfoque del copy/creatividad sin perder el tono de marca
  shortDescription    text              // para que la IA redacte el copy — lo que hoy me cuentas tú a mano
  targetAudience       text?             // si difiere del de la marca
  tags                 string[]
  sourceFilename       string            // trazabilidad del archivo original
  uploadedBy            string
  uploadedAt            datetime
  status                "ACTIVE" | "ARCHIVED"

AssetUsage                              // se crea sola cuando un Asset entra en una Publication
  id             uuid
  assetId        uuid
  publicationId  uuid
  network        string                 // "instagram", "twitter"...
  usedAt         datetime

Publication                             // antes "Post" — ahora agnóstico de red
  id               uuid (interno, estable)
  format           "FEED_POST" | "CAROUSEL" | "STORY" | "REEL" | "VIDEO_POST"
  publicationDate  datetime + timezone
  text             string
  assetIds         uuid[]                // referencias a Asset, 1 o varias según el formato
  targets          PublicationTarget[]   // una entrada por red donde se publica
  status           "PENDING" | "PUBLISHED" | "ERROR"
  lastSyncedAt     datetime
  lastDriftNote    string?

PublicationTarget
  network          "instagram" | "twitter" | "linkedin" | ...   // extensible
  metricoolId      number            // ID actual en Metricool para ESTA red — muta en cada PUT
  collaborators    string[]?         // específico de Instagram; cada adaptador decide qué campos usa
  status           "PENDING" | "PUBLISHED" | "ERROR"

SyncLog
  id            uuid
  entityType    "PUBLICATION" | "ASSET"
  entityId      uuid
  action        "CREATE" | "UPDATE" | "DELETE" | "VERIFY"
  beforeState   json?
  afterState    json?
  driftDetected boolean
  createdAt     datetime
```

Cambios clave respecto a la v1: `MediaAsset` pasa a ser `Asset`, con toda la metadata que pediste, y aparecen `Brand`/`Photographer` como catálogos propios en vez de campos de texto libre repetidos en cada foto. `Post` pasa a llamarse `Publication` y ya no asume Instagram: cada red donde se publique es un `PublicationTarget` independiente, con su propio `metricoolId` y su propio estado — así, cuando añadas LinkedIn el año que viene, un mismo `Publication` puede tener un target de Instagram y otro de LinkedIn sin cambiar el modelo.

## 4. Gestor de assets — diseño

**El problema que resuelve:** hoy, para escribir el copy de un post, dependo de que me cuentes a mano en el chat de qué objeto se trata, quién es el fotógrafo, qué tono usar. Con el DAM, esa información se captura **una vez, al subir la foto**, y yo la consulto por API cuando toca redactar — así afino mejor el contenido y además queda un registro de qué material se ha usado y cuándo.

**Subida (UI web, `/assets/upload`):**
- Selector de archivos múltiple (fotos y/o vídeos, drag-and-drop).
- Un bloque de **metadata compartida**, aplicable a toda la tanda subida a la vez: marca (selector sobre `Brand`, con opción de crear una nueva), fotógrafo (selector sobre `Photographer`, con opción de crear uno nuevo), categoría, público objetivo, tags.
- Por cada archivo de la tanda, campos que normalmente varían pieza a pieza: tipo de objeto, URL del producto (ficha en la tienda o web de la marca), URL de inspiración (post de referencia con buen engagement), descripción breve para la IA, tags adicionales — con la metadata compartida ya rellenada por defecto y editable individualmente.
- Al confirmar: cada archivo sube a Vercel Blob, se generan las variantes por red (ver abajo) y se crea un `Asset` por archivo.

**Variantes generadas automáticamente al subir:**
Un catálogo de ratios por red, hoy solo Instagram (feed 4:5 = 1080×1440, story 9:16 exacto = 1080×1920), ampliable según el catálogo de redes de §5 (p. ej. LinkedIn usa otro ratio de feed). Se generan las variantes conocidas en el momento de subir; si más adelante se activa una red nueva, un job puede rellenar variantes que falten para assets ya existentes sin volver a pedir el archivo original.

**Consulta (lo que yo uso al redactar contenido):**
`GET /api/assets` con filtros — por marca, categoría, tipo de objeto, fotógrafo, tag, rango de fechas de subida, y muy especialmente `unusedSince` / `neverUsed` para poder proponerte variedad en vez de repetir siempre el mismo material. La respuesta incluye toda la metadata (incluida `shortDescription`, `productUrl`, `inspirationUrl`, tono y público objetivo de la marca) y el historial de uso (`AssetUsage`), para que al escribir el copy tenga contexto real en vez de adivinarlo por el nombre del archivo — `productUrl` además sirve como referencia para el CTA o el enlace en bio cuando toque, e `inspirationUrl` como referencia de enfoque/tono de un post ajeno con buen engagement, adaptado siempre a la identidad de marca.

**Registro de uso:** no hace falta que nadie lo marque a mano — se crea una fila en `AssetUsage` automáticamente cada vez que un `Asset` entra en el `assetIds` de una `Publication` nueva, una por cada red (`target`) donde se publique.

**UI de exploración (`/assets`):** un grid con miniaturas, los mismos filtros que el endpoint, y edición de metadata en sitio — el reemplazo directo de "explorar el directorio".

## 5. Integración con Metricool y capa de adaptadores por red

Todo lo aprendido sobre la API de Metricool esta sesión sigue aplicando tal cual — vive ahora dentro de `lib/networks/instagram.ts`, como el primer adaptador de un patrón pensado para crecer.

**Patrón adaptador:** cada red implementa una interfaz común —

```
interface NetworkAdapter {
  name: string
  aspectRatios: Record<PublicationFormat, { w: number; h: number; exact: boolean }>
  buildProviderPayload(target: PublicationTarget): object   // el bloque `<red>Data` que Metricool espera
  validateAsset(asset: Asset, format: PublicationFormat): void
}
```

`lib/networks/instagram.ts` implementa esa interfaz con todo lo que ya sabemos:

**Base y auth (Metricool):**
```
BASE_URL = https://app.metricool.com/api
Header:   X-Mc-Auth: <METRICOOL_USER_TOKEN>
Query en todas las llamadas: blogId=<METRICOOL_BLOG_ID>&userId=<METRICOOL_USER_ID>
```

**Endpoints usados:**

| Método | Ruta | Notas |
|---|---|---|
| GET | `/v2/scheduler/posts?start=&end=` | Lista; respuesta envuelta en `{data: [...]}`. `start`/`end` exigen formato exacto `yyyy-MM-dd'T'HH:mm:ss` (sin offset de zona) — un `YYYY-MM-DD` a secas da `400 ValidationError`. Confirmado contra la API real construyendo `/api/health` |
| GET | `/v2/scheduler/posts/{id}` | Un post; `{data: {...}}` |
| POST | `/v2/scheduler/posts` | Crea. Devuelve el post creado con su `id` |
| PUT | `/v2/scheduler/posts/{id}` | **Reemplaza** el post — Metricool asigna un `id` nuevo, el viejo pasa a dar 404. Capturar siempre el `id` de la respuesta y persistirlo en `PublicationTarget.metricoolId` |
| DELETE | `/v2/scheduler/posts/{id}` | Devuelve `{data: true}` |
| GET | `/actions/normalize/image/url?url=<url pública, url-encoded>` | Descarga la imagen desde esa URL pública y la re-hostea en `static.metricool.com`. **Responde texto plano** (una URL entre comillas), no JSON |

**Reglas de payload para `PUT`/`POST` (probadas a base de error 500):**
- Antes de reenviar un post obtenido por `GET`, eliminar: `creationDate`, `hasNotReadNotes`, `uuid`, `creatorUserMail`, `creatorUserId`.
- `providers` se simplifica siempre a `[{ network: "instagram" }]` (o la lista de redes del `Publication.targets`) — nunca reenviar `status`/`detailedStatus`, son de solo lectura y provocan `500 PublicationStatusCode`.
- `collaborators` (Instagram) va en la raíz del post como **array de objetos** `[{ username: "handle" }]`. Un array de strings provoca un 500 muy explícito. El campo no se refleja de vuelta en los `GET` posteriores.
- `media` es un array de URLs ya normalizadas vía `static.metricool.com`, en el orden del carrusel.
- `instagramData.type` acepta `"POST"` o `"STORY"`. Las Stories llevan `autoPublish: true` tanto a nivel raíz como dentro de `instagramData`.

**Ratios de imagen por formato (Instagram):**
- Feed/carrusel: estándar de esta cuenta 0.75 (1080×1440).
- Story: **exactamente** 9:16 (0.5625) — Metricool rechaza cualquier otra cosa con un error explícito. `validateAsset()` del adaptador debe comprobarlo antes de enviar, no confiar solo en la respuesta de Metricool.

**El quirk que más tiempo costó — auto-reprogramación silenciosa:**
Tras escribir (`POST`/`PUT`), Metricool puede recolocar por su cuenta la hora — a veces el día — de posts pendientes, sin avisar en la respuesta. **Mitigación obligatoria:** tras cualquier lote de escrituras, re-`GET` de los afectados y comparar contra lo pedido; registrar diferencias en `SyncLog` con `driftDetected: true`.

**Añadir una red nueva en el futuro** (LinkedIn, X, TikTok...) es, con este diseño: crear `lib/networks/<red>.ts` implementando `NetworkAdapter`, añadir su bloque `<red>Data` según la documentación de Metricool para esa red, y registrar sus ratios propios — sin tocar `Publication`, `Asset` ni los endpoints existentes.

## 6. API propia — endpoints que expongo a Claude

Todas bajo `x-api-key` propio.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/health` | Comprueba token de Metricool válido y DB accesible |
| **Assets** | | |
| POST | `/api/assets` | Sube uno o varios archivos (`multipart/form-data`) + metadata compartida y por archivo; genera variantes y crea los `Asset` |
| GET | `/api/assets?brand=&category=&objectType=&photographer=&tag=&unusedSince=&kind=` | Lista assets con toda su metadata e historial de uso, paginado |
| GET | `/api/assets/:id` | Detalle de un asset, incluida su `AssetUsage` |
| PATCH | `/api/assets/:id` | Edita metadata |
| DELETE | `/api/assets/:id` | Archiva (no borra el blob salvo que se pida explícitamente) |
| GET, POST | `/api/brands` | Catálogo de marcas |
| GET, POST | `/api/photographers` | Catálogo de fotógrafos |
| **Publicaciones** | | |
| GET | `/api/publications?from=&to=&network=` | Lista publicaciones en rango, opcionalmente filtradas por red |
| POST | `/api/publications` | Crea publicación (`format`, `assetIds`, `text`, `publicationDate`, `targets: [{network, collaborators?}]`) — registra `AssetUsage` automáticamente |
| PATCH | `/api/publications/:id` | Edita texto/medios/fecha/targets; internamente hace el `PUT` a cada red afectada y actualiza sus `metricoolId` |
| DELETE | `/api/publications/:id` | Borra en cada red y marca el registro interno |
| POST | `/api/publications/:id/story` | Crea una Story asociada (Instagram, hoy) recortando automáticamente a 9:16 |
| POST | `/api/verify` | Re-consulta cada red para un rango de fechas y devuelve el diff contra el estado interno |

## 7. Estructura del repositorio

```
noru-metricool-bridge/
├── app/
│   ├── assets/                    // UI web del gestor de assets
│   │   ├── page.tsx                // grid + filtros (componentes shadcn)
│   │   └── upload/page.tsx         // subida múltiple con metadata (Form de shadcn)
│   ├── globals.css                 // Tailwind + tokens de shadcn
│   └── api/
│       ├── health/route.ts
│       ├── assets/route.ts
│       ├── assets/[id]/route.ts
│       ├── brands/route.ts
│       ├── photographers/route.ts
│       ├── publications/route.ts
│       ├── publications/[id]/route.ts
│       ├── publications/[id]/story/route.ts
│       └── verify/route.ts
├── lib/
│   ├── networks/
│   │   ├── types.ts          // interfaz NetworkAdapter
│   │   ├── instagram.ts       // adaptador de Instagram (todo el §5)
│   │   └── index.ts            // registro de adaptadores disponibles
│   ├── assets.ts                // lógica de subida, variantes, filtros
│   ├── images.ts                 // sharp: recortes por ratio
│   ├── video.ts                   // miniaturas/metadata de vídeo
│   ├── blob.ts                     // subida a Vercel Blob
│   ├── db.ts                        // cliente de base de datos
│   └── auth.ts                       // x-api-key (API) + sesión (UI web)
├── db/
│   └── schema.ts                      // Brand, Photographer, Asset, AssetUsage, Publication, PublicationTarget, SyncLog
├── components/
│   └── ui/                            // componentes de shadcn/ui (se van añadiendo con `npx shadcn@latest add <componente>`)
├── components.json                     // config de shadcn/ui
├── .env.local.example
├── vercel.json
└── ARCHITECTURE.md                     // este documento, copiado dentro del repo
```

## 8. Variables de entorno

```
METRICOOL_USER_TOKEN=
METRICOOL_USER_ID=
METRICOOL_BLOG_ID=
INTERNAL_API_KEY=          # la que Claude usará en el header x-api-key
BLOB_READ_WRITE_TOKEN=     # lo genera Vercel al crear el Blob store
DATABASE_URL=              # Vercel Postgres / Neon
AUTH_SECRET=                # para el login de la UI web (next-auth)
```

## 9. Plan de implementación por fases

**Fase 0 — Scaffold**
Next.js 16 + TypeScript + ESLint, `vercel.json` mínimo, `.env.local.example`, README. Inicializar Tailwind + shadcn/ui (`npx shadcn@latest init`) aunque los componentes concretos se añadan más adelante en la Fase 5 — así el proyecto arranca ya con la configuración de estilos correcta.

**Fase 1 — Cliente Metricool / adaptador Instagram**
`lib/networks/types.ts` (interfaz `NetworkAdapter`) y `lib/networks/instagram.ts` implementándola con `listPosts`, `getPost`, `createPost`, `updatePost`, `deletePost`, `normalizeImageUrl`, `validateAsset`. Tests unitarios con respuestas mockeadas.

**Fase 2 — Pipeline de imágenes y vídeo**
`lib/images.ts` (`sharp`): recorte por ratio, parametrizado por el catálogo de ratios del adaptador (no hardcodeado a Instagram). `lib/video.ts`: extracción de miniatura y duración de vídeos subidos. `lib/blob.ts` para subida a Vercel Blob.

**Fase 3 — Capa de datos**
Schema completo del §3 (`Brand`, `Photographer`, `Asset`, `AssetUsage`, `Publication`, `PublicationTarget`, `SyncLog`) con `drizzle`. Migraciones. CRUD interno.

**Fase 4 — Gestor de assets: API**
Endpoints de `/api/assets`, `/api/brands`, `/api/photographers` del §6. Subida `multipart/form-data` con metadata compartida + por archivo. Generación de variantes al subir.

**Fase 5 — Gestor de assets: UI web**
`/assets` (grid + filtros) y `/assets/upload` (subida múltiple con formulario de metadata), construidos con componentes de shadcn/ui: `Table`/`Card` para el grid, `Select`/`Combobox` para elegir marca y fotógrafo existentes (con opción de crear uno nuevo inline), `Dialog` o `Sheet` para editar metadata de un asset, `Form` (con `react-hook-form` + `zod`, patrón estándar de shadcn) para el formulario de subida, y un dropzone de archivos múltiples. Login simple para proteger la subida.

**Fase 6 — Endpoints de publicaciones**
`/api/publications` y derivados, usando el adaptador de Instagram. Registro automático de `AssetUsage` al crear una publicación.

**Fase 7 — Verificación post-escritura**
`lib/verify.ts`: re-consulta cada red tras un lote de escrituras, marca `driftDetected`. Expuesto como `/api/verify`.

**Fase 8 — Auth de la API**
Middleware `x-api-key` en `/api/*` (salvo `/api/health` si se prefiere abierto para monitorización).

**Fase 9 — Smoke tests end-to-end**
Subir un asset de prueba, crear publicación, verificar, crear story asociada, editar, borrar. Confirmar que la cuenta de Metricool y la base de datos quedan consistentes entre sí.

**Fase 10 — Deploy** (ver §10)

*(Fases futuras, no en este plan todavía: adaptador de una segunda red social cuando se decida cuál; generación de variantes de asset bajo demanda para redes añadidas después de que el asset ya existiera.)*

## 10. Despliegue: GitHub + Vercel

```bash
# 1. Repo local y primer commit
cd noru-metricool-bridge
git init
git add .
git commit -m "Scaffold inicial"

# 2. Crear el repo en GitHub
gh repo create noru-metricool-bridge --private --source=. --remote=origin
git push -u origin main

# 3. Vincular con Vercel
npx vercel link
npx vercel env add METRICOOL_USER_TOKEN
npx vercel env add METRICOOL_USER_ID
npx vercel env add METRICOOL_BLOG_ID
npx vercel env add INTERNAL_API_KEY
npx vercel env add DATABASE_URL
npx vercel env add AUTH_SECRET
# BLOB_READ_WRITE_TOKEN se genera al crear el Blob store desde el dashboard de Vercel
# (Storage → Create → Blob), y Vercel lo inyecta solo si conectas el store al proyecto

# 4. Primer deploy
npx vercel --prod

# 5. Smoke test
curl https://<tu-proyecto>.vercel.app/api/health -H "x-api-key: $INTERNAL_API_KEY"
```

A partir de aquí, cada `git push` a `main` redeploy automáticamente si conectas el repo desde el dashboard de Vercel.

**Última pieza:** una vez desplegado, pásame la URL de producción y el `INTERNAL_API_KEY` (por un canal que no quede en texto plano en el chat si puedes evitarlo) y dejo de depender de la pestaña de Chrome — te llamo la API directamente.

## 11. Prompt de arranque para el agente de Claude Code

Copia esto como primer mensaje en VS Code, con este archivo (`ARCHITECTURE.md`) ya dentro del repo:

> Lee `ARCHITECTURE.md` en la raíz de este repo antes de escribir nada. Es la especificación completa del proyecto: contexto, modelo de dominio (incluye el gestor de assets con marca/fotógrafo/metadata y el diseño multi-red), integración con Metricool vía capa de adaptadores, diseño de la API propia, estructura de carpetas y plan por fases.
>
> Implementa únicamente la **Fase 0** y la **Fase 1** de la sección 9. Al terminar cada fase, para y espera confirmación antes de seguir con la siguiente — no implementes fases futuras por adelantado aunque te parezcan obvias.
>
> Usa TypeScript estricto. Para la Fase 1, escribe también tests unitarios del adaptador de Instagram usando respuestas mockeadas basadas en los ejemplos de la sección 5 del documento (incluye un caso que confirme que `collaborators` como array de strings se rechaza antes de llegar a la red, y un caso que confirme el parseo del texto plano de `normalizeImageUrl`).
>
> No hardcodees ningún secreto — usa `.env.local` a partir de `.env.local.example`.
