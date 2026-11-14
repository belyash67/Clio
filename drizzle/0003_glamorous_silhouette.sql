CREATE TABLE "catalog_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_media_type" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"original_title" text NOT NULL,
	"poster_path" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_type_allowed" CHECK ("media"."tmdb_media_type" in ('movie', 'tv')),
	CONSTRAINT "media_tmdb_id_positive" CHECK ("media"."tmdb_id" > 0)
);
--> statement-breakpoint
CREATE INDEX "catalog_cache_expiry_idx" ON "catalog_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_tmdb_unique" ON "media" USING btree ("tmdb_media_type","tmdb_id");