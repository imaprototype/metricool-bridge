CREATE TYPE "public"."asset_kind" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."publication_format" AS ENUM('FEED_POST', 'CAROUSEL', 'STORY', 'REEL', 'VIDEO_POST');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('PENDING', 'PUBLISHED', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."sync_log_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'VERIFY');--> statement-breakpoint
CREATE TYPE "public"."sync_log_entity_type" AS ENUM('PUBLICATION', 'ASSET');--> statement-breakpoint
CREATE TABLE "asset_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"network" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"original_blob_url" text NOT NULL,
	"variants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"brand_id" uuid NOT NULL,
	"photographer_id" uuid,
	"object_type" text NOT NULL,
	"category" text NOT NULL,
	"product_url" text,
	"inspiration_url" text,
	"short_description" text NOT NULL,
	"target_audience" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"source_filename" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "asset_status" DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"instagram_handle" text,
	"tone_notes" text,
	"target_audience" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photographers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"instagram_handle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"network" text NOT NULL,
	"metricool_id" integer,
	"collaborators" text[],
	"status" "publication_status" DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"format" "publication_format" NOT NULL,
	"publication_date" timestamp with time zone NOT NULL,
	"text" text NOT NULL,
	"asset_ids" uuid[] DEFAULT '{}' NOT NULL,
	"status" "publication_status" DEFAULT 'PENDING' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_drift_note" text
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "sync_log_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "sync_log_action" NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"drift_detected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_targets" ADD CONSTRAINT "publication_targets_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;