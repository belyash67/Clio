ALTER TABLE "users" ADD COLUMN "consent_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_snapshot" text;