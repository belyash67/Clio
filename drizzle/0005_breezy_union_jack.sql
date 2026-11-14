ALTER TABLE "media" ADD COLUMN "title_override" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "animation_override" text;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_animation_override" CHECK ("media"."animation_override" is null or "media"."animation_override" in ('animation','anime','none'));