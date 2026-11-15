import { sql } from "drizzle-orm";
import { bigint, boolean, check, date as pgDate, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const date = (name: string) => timestamp(name, { withTimezone: true });
export const visibility = pgEnum("visibility", ["private", "friends", "public"]);

export const user = pgTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  username: text("username").notNull().unique(),
  displayUsername: text("display_username"),
  bio: text("bio").default("").notNull(),
  blockedAt: date("blocked_at"),
  personalBadge: boolean("personal_badge").notNull().default(false),
  consentVersion: text("consent_version"),
  consentAcceptedAt: date("consent_accepted_at"),
  consentSnapshot: text("consent_snapshot"),
  createdAt: date("created_at").defaultNow().notNull(),
  updatedAt: date("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
  uniqueIndex("users_username_lower_unique").on(sql`lower(${table.username})`),
  check("users_username_format", sql`${table.username} ~ '^[a-z0-9_]{3,30}$'`),
  check("users_name_length", sql`char_length(${table.name}) between 1 and 60`),
  check("users_bio_length", sql`char_length(${table.bio}) <= 500`),
]);

export const session = pgTable("sessions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  expiresAt: date("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: date("created_at").defaultNow().notNull(),
  updatedAt: date("updated_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const account = pgTable("accounts", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: date("access_token_expires_at"), refreshTokenExpiresAt: date("refresh_token_expires_at"),
  scope: text("scope"), password: text("password"),
  createdAt: date("created_at").defaultNow().notNull(), updatedAt: date("updated_at").defaultNow().notNull(),
}, (table) => [index("accounts_user_idx").on(table.userId), uniqueIndex("accounts_provider_unique").on(table.providerId, table.accountId)]);

export const verification = pgTable("verifications", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: date("expires_at").notNull(),
  createdAt: date("created_at").defaultNow().notNull(), updatedAt: date("updated_at").defaultNow().notNull(),
}, (table) => [index("verifications_identifier_idx").on(table.identifier)]);

export const rateLimit = pgTable("rate_limits", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`), key: text("key").notNull().unique(),
  count: integer("count").notNull(), lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  profileVisibility: visibility("profile_visibility").default("friends").notNull(),
  libraryVisibility: visibility("library_visibility").default("private").notNull(),
  activityVisibility: visibility("activity_visibility").default("private").notNull(),
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  language: text("language").default("ru").notNull(),
});

export const userRoles = pgTable("user_roles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("user"),
}, (table) => [check("user_roles_allowed", sql`${table.role} in ('user', 'admin')`)]);

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  tmdbMediaType: text("tmdb_media_type").notNull(),
  tmdbId: integer("tmdb_id").notNull(),
  originalTitle: text("original_title").notNull(),
  title: text("title").notNull().default(""),
  titleOverride: text("title_override"),
  animationOverride: text("animation_override"),
  genreIds: jsonb("genre_ids").$type<number[]>().notNull().default([]),
  posterPath: text("poster_path"),
  updatedAt: date("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("media_tmdb_unique").on(table.tmdbMediaType, table.tmdbId),
  check("media_type_allowed", sql`${table.tmdbMediaType} in ('movie', 'tv')`),
  check("media_tmdb_id_positive", sql`${table.tmdbId} > 0`),
  check("media_animation_override", sql`${table.animationOverride} is null or ${table.animationOverride} in ('animation','anime','none')`),
]);

export const catalogCache = pgTable("catalog_cache", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(),
  fetchedAt: date("fetched_at").notNull(),
  expiresAt: date("expires_at").notNull(),
}, (table) => [index("catalog_cache_expiry_idx").on(table.expiresAt)]);

const ownerId = () => text("user_id").notNull().references(() => user.id, { onDelete: "cascade" });
const mediaId = () => uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" });
const createdAt = () => date("created_at").defaultNow().notNull();
export const library = pgTable("user_library", {
  userId: ownerId(), mediaId: mediaId(), status: text("status"), favorite: boolean("favorite").notNull().default(false), updatedAt: date("updated_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.mediaId] }), check("library_status", sql`${t.status} is null or ${t.status} in ('watched','watching','later','dropped')`), index("library_owner_idx").on(t.userId, t.updatedAt)]);

export const watches = pgTable("watch_history", {
  id: uuid("id").primaryKey().defaultRandom(), userId: ownerId(), mediaId: mediaId(), watchedOn: pgDate("watched_on").notNull(), note: text("note").notNull().default(""), createdAt: createdAt(),
}, (t) => [index("watches_owner_date").on(t.userId, t.watchedOn), check("watch_note_length", sql`char_length(${t.note}) <= 1000`)]);
export const ratings = pgTable("ratings", {
  userId: ownerId(), mediaId: mediaId(), score: integer("score").notNull(), updatedAt: date("updated_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.mediaId] }), check("rating_score", sql`${t.score} between 2 and 20`), index("ratings_media_idx").on(t.mediaId)]);
export const ratingEvents = pgTable("rating_events", {
  id: uuid("id").primaryKey().defaultRandom(), userId: ownerId(), mediaId: mediaId(), oldScore: integer("old_score"), newScore: integer("new_score"), createdAt: createdAt(),
}, (t) => [check("rating_event_scores", sql`(${t.oldScore} is null or ${t.oldScore} between 2 and 20) and (${t.newScore} is null or ${t.newScore} between 2 and 20)`)]);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(), userId: ownerId(), mediaId: mediaId(), body: text("body").notNull(), visibility: visibility("visibility").notNull().default("private"), spoiler: boolean("spoiler").notNull().default(false), hidden: boolean("hidden").notNull().default(false), createdAt: createdAt(), updatedAt: date("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("review_user_media").on(t.userId, t.mediaId), index("review_media_date").on(t.mediaId, t.createdAt), check("review_length", sql`char_length(${t.body}) between 1 and 10000`)]);
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(), userId: ownerId(), reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }), parentId: uuid("parent_id"), body: text("body").notNull(), hidden: boolean("hidden").notNull().default(false), createdAt: createdAt(),
}, (t) => [unique("comment_id_review").on(t.id, t.reviewId), foreignKey({ columns: [t.parentId, t.reviewId], foreignColumns: [t.id, t.reviewId], name: "comment_same_review_parent" }).onDelete("cascade"), check("comment_length", sql`char_length(${t.body}) between 1 and 2000`), index("comments_review_date").on(t.reviewId, t.createdAt)]);
export const reviewLikes = pgTable("review_likes", {
  userId: ownerId(), reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.userId, t.reviewId] })]);

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(), userId: ownerId(), title: text("title").notNull(), description: text("description").notNull().default(""), public: boolean("public").notNull().default(false), createdAt: createdAt(), updatedAt: date("updated_at").defaultNow().notNull(),
}, (t) => [check("collection_lengths", sql`char_length(${t.title}) between 1 and 100 and char_length(${t.description}) <= 2000`), index("collections_owner_idx").on(t.userId)]);
export const collectionMedia = pgTable("collection_media", {
  collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }), mediaId: mediaId(), position: integer("position").notNull(),
}, (t) => [primaryKey({ columns: [t.collectionId, t.mediaId] }), uniqueIndex("collection_position").on(t.collectionId, t.position)]);
export const friendships = pgTable("friendships", {
  lowId: text("low_id").notNull().references(() => user.id, { onDelete: "cascade" }), highId: text("high_id").notNull().references(() => user.id, { onDelete: "cascade" }), requestedBy: text("requested_by").notNull().references(() => user.id, { onDelete: "cascade" }), status: text("status").notNull().default("pending"), createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.lowId, t.highId] }), check("friendship_pair", sql`${t.lowId} < ${t.highId} and ${t.requestedBy} in (${t.lowId}, ${t.highId}) and ${t.status} in ('pending','accepted')`), index("friend_high_idx").on(t.highId)]);
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(), userId: ownerId(), actorId: text("actor_id").notNull().references(() => user.id, { onDelete: "cascade" }), kind: text("kind").notNull(), reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }), dedupeKey: text("dedupe_key").notNull().unique(), readAt: date("read_at"), createdAt: createdAt(),
}, (t) => [index("notifications_owner_date").on(t.userId, t.createdAt)]);
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(), userId: ownerId(), reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "set null" }), commentId: uuid("comment_id").references(() => comments.id, { onDelete: "set null" }), targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }), reason: text("reason").notNull(), resolved: boolean("resolved").notNull().default(false), createdAt: createdAt(),
}, (t) => [check("report_reason_length", sql`char_length(${t.reason}) between 1 and 1000`)]);
export const moderationActions = pgTable("moderation_actions", {
  id: uuid("id").primaryKey().defaultRandom(), userId: ownerId(), action: text("action").notNull(), reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }), createdAt: createdAt(),
});
