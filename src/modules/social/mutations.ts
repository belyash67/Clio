import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { comments, friendships, notifications, reports, reviewLikes, user, userSettings } from "@/server/db/schema";
import { type Context, id, value, text, must, canReadReview, notify } from "./common";

export async function socialMutation(ctx: Context, op: string, data: FormData) {
  const { db, uid } = ctx;
  if (op.startsWith("friend-")) {
    const target = value(data, "targetId"); must(target && target !== uid);
    const [targetUser] = await db.select({ id: user.id }).from(user).leftJoin(userSettings, eq(userSettings.userId, user.id)).where(and(eq(user.id, target), sql`${user.blockedAt} is null`, ...(op === "friend-request" ? [eq(userSettings.profileVisibility, "public")] : [])));
    must(targetUser);
    const [lowId, highId] = [uid, target].sort();
    const pair = and(eq(friendships.lowId, lowId), eq(friendships.highId, highId));
    if (op === "friend-request") {
      const added = await db.insert(friendships).values({ lowId, highId, requestedBy: uid }).onConflictDoNothing().returning();
      if (added.length) await notify(db, target, uid, "friend-request", `friend:${lowId}:${highId}:${randomUUID()}`);
    } else if (op === "friend-accept") {
      const accepted = await db.update(friendships).set({ status: "accepted" }).where(and(pair, ne(friendships.requestedBy, uid), eq(friendships.status, "pending"))).returning();
      must(accepted.length);
      await notify(db, target, uid, "friend-accepted", `accepted:${lowId}:${highId}:${randomUUID()}`);
    } else if (op === "friend-remove") await db.delete(friendships).where(pair);
    else throw new Error("UNKNOWN_FRIEND_ACTION");
  } else if (op === "comment-add") {
    const reviewId = id(data, "reviewId"); const review = await canReadReview(ctx, reviewId); must(review);
    const parentId = value(data, "parentId") || null;
    if (parentId) must((await db.select().from(comments).where(and(eq(comments.id, id(data, "parentId")), eq(comments.reviewId, reviewId), eq(comments.hidden, false)))).length);
    const [created] = await db.insert(comments).values({ userId: uid, reviewId, parentId, body: text(data, "body", 2000) }).returning();
    await notify(db, review.userId, uid, "comment", `comment:${created.id}`, reviewId);
    if (parentId) { const [parent] = await db.select().from(comments).where(eq(comments.id, parentId)); if (parent) await notify(db, parent.userId, uid, "reply", `reply:${created.id}`, reviewId); }
  } else if(op==="comment-edit") {
    const [comment]=await db.select().from(comments).where(and(eq(comments.id,id(data)),eq(comments.userId,uid)));
    must(comment&&await canReadReview(ctx,comment.reviewId));
    await db.update(comments).set({body:text(data,"body",2000)}).where(and(eq(comments.id,comment.id),eq(comments.userId,uid)));
  } else if (op === "comment-delete") {
    must((await db.delete(comments).where(and(eq(comments.id, id(data)), eq(comments.userId, uid))).returning()).length);
  } else if (op === "review-like") {
    const reviewId = id(data, "reviewId"); const review = await canReadReview(ctx, reviewId); must(review);
    if (value(data, "liked") === "true") await db.delete(reviewLikes).where(and(eq(reviewLikes.userId, uid), eq(reviewLikes.reviewId, reviewId)));
    else {
      const added = await db.insert(reviewLikes).values({ userId: uid, reviewId }).onConflictDoNothing().returning();
      if (added.length) await notify(db, review.userId, uid, "like", `like:${uid}:${reviewId}`, reviewId);
    }
  } else if (op === "notifications-read") await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, uid));
  else if (op === "report-create") {
    const reviewId = value(data, "reviewId") || null; const commentId = value(data, "commentId") || null; const targetUserId = value(data, "targetUserId") || null;
    must([reviewId, commentId, targetUserId].filter(Boolean).length === 1);
    if (reviewId) must(await canReadReview(ctx, id(data, "reviewId")));
    if (commentId) { const [comment] = await db.select().from(comments).where(eq(comments.id, id(data, "commentId"))); must(comment && await canReadReview(ctx, comment.reviewId)); }
    if (targetUserId) must((await db.select().from(user).innerJoin(userSettings, eq(userSettings.userId, user.id)).where(and(eq(user.id, targetUserId), eq(userSettings.profileVisibility, "public")))).length);
    await db.insert(reports).values({ userId: uid, reviewId, commentId, targetUserId, reason: text(data, "reason", 1000) });
  } else throw new Error("UNKNOWN_SOCIAL_ACTION");
}
