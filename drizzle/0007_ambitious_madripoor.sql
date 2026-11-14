ALTER TABLE "user_settings" ALTER COLUMN "profile_visibility" SET DEFAULT 'friends';
--> statement-breakpoint
UPDATE "user_settings" SET "profile_visibility" = 'friends' WHERE "profile_visibility" = 'private';
