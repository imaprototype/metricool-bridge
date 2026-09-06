ALTER TABLE "assets" DROP CONSTRAINT "assets_photographer_id_photographers_id_fk";
--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "photographer_id";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "target_audience";