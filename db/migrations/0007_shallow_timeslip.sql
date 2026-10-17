ALTER TYPE "public"."publication_format" ADD VALUE 'FB_POST';--> statement-breakpoint
ALTER TABLE "publication_targets" ADD COLUMN "title" text;