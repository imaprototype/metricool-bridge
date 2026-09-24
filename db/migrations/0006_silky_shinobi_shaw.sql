ALTER TYPE "public"."publication_format" ADD VALUE 'PIN';--> statement-breakpoint
ALTER TABLE "publication_targets" ADD COLUMN "board_id" text;--> statement-breakpoint
ALTER TABLE "publication_targets" ADD COLUMN "pin_title" text;--> statement-breakpoint
ALTER TABLE "publication_targets" ADD COLUMN "pin_link" text;