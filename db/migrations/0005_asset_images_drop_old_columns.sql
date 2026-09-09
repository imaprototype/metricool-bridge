ALTER TABLE "publications" ALTER COLUMN "asset_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "original_blob_url";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "variants";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "source_filename";--> statement-breakpoint
ALTER TABLE "publications" DROP COLUMN "asset_ids";