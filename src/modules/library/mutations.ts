import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { library, watches, ratings, ratingEvents, reviews, media } from "@/server/db/schema";
import { type Context, id, value, text, must } from "@/modules/social/common";

export async function libraryMutation(ctx: Context, op: string, data: FormData) {
  const { db, uid } = ctx;
  if(op==="watch-edit") {
    const watchedOn=z.iso.date().parse(value(data,"watchedOn"));
    must(watchedOn<=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Moscow"}),"Дата просмотра не может быть в будущем.");
    must((await db.update(watches).set({watchedOn,note:text(data,"note",1000,0)}).where(and(eq(watches.id,id(data)),eq(watches.userId,uid))).returning()).length);return;
  }
  if (op === "watch-delete" || op === "review-delete") {
    const table = op === "watch-delete" ? watches : reviews;
    const deleted = await db.delete(table).where(and(eq(table.id, id(data)), eq(table.userId, uid))).returning({ id: table.id, mediaId: table.mediaId });
    must(deleted.length);
    if(op==="review-delete") {
      const [title]=await db.select({type:media.tmdbMediaType,tmdbId:media.tmdbId}).from(media).where(eq(media.id,deleted[0].mediaId));
      return `/catalog/${title.type}/${title.tmdbId}`;
    }
    return;
  }
  const mid = id(data, "mediaId");
  must((await db.select({ id: media.id }).from(media).where(eq(media.id, mid))).length);
  if (op === "library-save") {
    const status = z.enum(["", "watched", "watching", "later", "dropped"]).parse(value(data, "status")) || null;
    const row = { status, favorite: data.has("favorite"), updatedAt: new Date() };
    await db.insert(library).values({ userId: uid, mediaId: mid, ...row }).onConflictDoUpdate({ target: [library.userId, library.mediaId], set: row });
  } else if (op === "library-delete") {
    await db.delete(library).where(and(eq(library.userId, uid), eq(library.mediaId, mid)));
  } else if (op === "rating-save") {
    const raw = value(data, "score");
    const score = raw === "" ? null : z.number().int().min(2).max(20).parse(Number(raw));
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${uid}:${mid}`}, 0))`);
      const [previous] = await tx.select().from(ratings).where(and(eq(ratings.userId, uid), eq(ratings.mediaId, mid)));
      if ((previous?.score ?? null) === score) return;
      if (score === null) await tx.delete(ratings).where(and(eq(ratings.userId, uid), eq(ratings.mediaId, mid)));
      else await tx.insert(ratings).values({ userId: uid, mediaId: mid, score }).onConflictDoUpdate({ target: [ratings.userId, ratings.mediaId], set: { score, updatedAt: new Date() } });
      await tx.insert(ratingEvents).values({ userId: uid, mediaId: mid, oldScore: previous?.score, newScore: score });
    });
  } else if (op === "watch-add") {
    const watchedOn = z.iso.date().parse(value(data, "watchedOn"));
    must(watchedOn <= new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" }), "Дата просмотра не может быть в будущем.");
    await db.transaction(async (tx) => {
      await tx.insert(watches).values({ userId: uid, mediaId: mid, watchedOn, note: text(data, "note", 1000, 0) });
      await tx.insert(library).values({ userId: uid, mediaId: mid, status: "watched" }).onConflictDoUpdate({ target: [library.userId, library.mediaId], set: { status: "watched", updatedAt: new Date() } });
    });
  } else if (op === "review-save") {
    const row = { body: text(data, "body", 10000), spoiler: data.has("spoiler"), visibility: z.enum(["private", "friends", "public"]).parse(value(data, "visibility")), updatedAt: new Date() };
    await db.insert(reviews).values({ userId: uid, mediaId: mid, ...row }).onConflictDoUpdate({ target: [reviews.userId, reviews.mediaId], set: row });
  } else throw new Error("UNKNOWN_LIBRARY_ACTION");
}
