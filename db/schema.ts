import { relations } from "drizzle-orm"
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

// Ver ARCHITECTURE.md §3 para el modelo de dominio completo.

export const assetKindEnum = pgEnum("asset_kind", ["IMAGE", "VIDEO"])
export const assetStatusEnum = pgEnum("asset_status", ["ACTIVE", "ARCHIVED"])
export const publicationFormatEnum = pgEnum("publication_format", [
  "FEED_POST",
  "CAROUSEL",
  "STORY",
  "REEL",
  "VIDEO_POST",
])
export const publicationStatusEnum = pgEnum("publication_status", ["PENDING", "PUBLISHED", "ERROR"])
export const syncLogEntityTypeEnum = pgEnum("sync_log_entity_type", ["PUBLICATION", "ASSET"])
export const syncLogActionEnum = pgEnum("sync_log_action", ["CREATE", "UPDATE", "DELETE", "VERIFY"])

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  instagramHandle: text("instagram_handle"),
  toneNotes: text("tone_notes"),
  targetAudience: text("target_audience"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const photographers = pgTable("photographers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  instagramHandle: text("instagram_handle"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

// Una "ficha" de producto/contenido — la metadata se comparte entre todas sus
// imágenes (ver asset_images). Un archivo subido ya no es un Asset propio.
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id),
  // 0 o varios fotógrafos — array sin FK real, igual que tags en esta app.
  photographerIds: uuid("photographer_ids").array().notNull().default([]),
  objectType: text("object_type").notNull(),
  // Ficha del producto (tienda, web de la marca...) — CTA y contexto para la IA.
  productUrl: text("product_url"),
  // Post de referencia (Instagram u otra red) con buen engagement, para orientar
  // el enfoque del copy/creatividad sin perder el tono de marca.
  inspirationUrl: text("inspiration_url"),
  shortDescription: text("short_description").notNull(),
  tags: text("tags").array().notNull().default([]),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  status: assetStatusEnum("status").notNull().default("ACTIVE"),
})

// Cada imagen/vídeo de una ficha — todas comparten el `kind` (se valida al
// subir, ver lib/assets.ts). `position` 0 = portada/imagen por defecto.
export const assetImages = pgTable("asset_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  kind: assetKindEnum("kind").notNull(),
  originalBlobUrl: text("original_blob_url").notNull(),
  // { FEED_POST: url, STORY: url, ... } — variantes generadas al subir (ver lib/images.ts)
  variants: jsonb("variants").notNull().default({}),
  sourceFilename: text("source_filename").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const publications = pgTable("publications", {
  id: uuid("id").primaryKey().defaultRandom(),
  format: publicationFormatEnum("format").notNull(),
  publicationDate: timestamp("publication_date", { withTimezone: true }).notNull(),
  // Zona horaria IANA con la que se interpreta publicationDate al construir
  // el payload de Metricool — su API exige un objeto { dateTime, timezone }
  // explícito, no basta con el instante UTC (confirmado contra la API real
  // en el smoke test de la Fase 9: un string ISO da 500 "no String-argument
  // constructor... DateTimeInfo"). Ver ARCHITECTURE.md §5.
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  text: text("text").notNull(),
  // Una publicación referencia UNA ficha — un CAROUSEL usa varias imágenes de
  // esa misma ficha, nunca de fichas distintas.
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  // Qué imágenes concretas de esa ficha se usaron, resuelto y guardado al
  // crear/editar (portada por defecto para formatos de 1 imagen, todas para
  // CAROUSEL) — array sin FK real, igual que tags.
  imageIds: uuid("image_ids").array().notNull().default([]),
  status: publicationStatusEnum("status").notNull().default("PENDING"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastDriftNote: text("last_drift_note"),
})

// Una fila por red donde se publica una Publication (ver ARCHITECTURE.md §3).
// `publicationId` no aparece como campo explícito en el documento porque ahí
// `targets` se describe como un array anidado bajo Publication — aquí se
// normaliza como tabla propia con su FK, ya que es la traducción directa a
// un modelo relacional.
export const publicationTargets = pgTable("publication_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicationId: uuid("publication_id")
    .notNull()
    .references(() => publications.id, { onDelete: "cascade" }),
  network: text("network").notNull(),
  // Muta en cada PUT a Metricool — null hasta la primera escritura exitosa.
  metricoolId: integer("metricool_id"),
  collaborators: text("collaborators").array(),
  status: publicationStatusEnum("status").notNull().default("PENDING"),
})

// Se crea sola cuando un Asset entra en una Publication (una fila por red/target).
export const assetUsages = pgTable("asset_usages", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  publicationId: uuid("publication_id")
    .notNull()
    .references(() => publications.id, { onDelete: "cascade" }),
  network: text("network").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
})

export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: syncLogEntityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: syncLogActionEnum("action").notNull(),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  driftDetected: boolean("drift_detected").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const brandsRelations = relations(brands, ({ many }) => ({
  assets: many(assets),
}))

export const assetsRelations = relations(assets, ({ one, many }) => ({
  brand: one(brands, { fields: [assets.brandId], references: [brands.id] }),
  // photographerIds es un array sin FK real (igual que tags) — sin relation
  // de drizzle, se resuelve a mano cuando haga falta el nombre del fotógrafo.
  images: many(assetImages),
  usages: many(assetUsages),
}))

export const assetImagesRelations = relations(assetImages, ({ one }) => ({
  asset: one(assets, { fields: [assetImages.assetId], references: [assets.id] }),
}))

export const publicationsRelations = relations(publications, ({ many }) => ({
  targets: many(publicationTargets),
  assetUsages: many(assetUsages),
}))

export const publicationTargetsRelations = relations(publicationTargets, ({ one }) => ({
  publication: one(publications, {
    fields: [publicationTargets.publicationId],
    references: [publications.id],
  }),
}))

export const assetUsagesRelations = relations(assetUsages, ({ one }) => ({
  asset: one(assets, { fields: [assetUsages.assetId], references: [assets.id] }),
  publication: one(publications, {
    fields: [assetUsages.publicationId],
    references: [publications.id],
  }),
}))
