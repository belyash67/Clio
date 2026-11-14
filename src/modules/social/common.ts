import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { notifications, reviews, user, userSettings } from "@/server/db/schema";
import { profileAudience, visibleTo } from "./policies";

export type AppDb = Omit<ReturnType<typeof getDb>, "$client">;
export type Context = { db: AppDb; uid: string; admin: boolean };
export class ActionError extends Error {}
export const uuid = z.uuid();
export function value(data: FormData, key: string) { return String(data.get(key) ?? ""); }
export function id(data: FormData, key = "id") { return uuid.parse(value(data, key)); }
export function text(data: FormData, key: string, max: number, min = 1) { return z.string().trim().min(min).max(max).parse(value(data, key)); }
export function must(condition: unknown, message = "Действие недоступно."): asserts condition { if (!condition) throw new ActionError(message); }

export async function canReadReview(ctx: Context, reviewId: string) {
  const rows = await ctx.db.select({ id: reviews.id, userId: reviews.userId, hidden: reviews.hidden }).from(reviews).innerJoin(user, eq(user.id, reviews.userId)).leftJoin(userSettings, eq(userSettings.userId, user.id)).where(and(
    eq(reviews.id, reviewId), eq(reviews.hidden, false), sql`${user.blockedAt} is null`,
    profileAudience(sql`${user.id}`, sql`${userSettings.profileVisibility}`, ctx.uid),
    visibleTo(sql`${user.id}`, sql`${reviews.visibility}`, ctx.uid),
  )).limit(1);
  return rows[0];
}

export async function notify(db: AppDb, target: string, actor: string, kind: string, key: string, reviewId?: string) {
  if (target === actor) return;
  const [settings] = await db.select({ enabled: userSettings.notificationsEnabled }).from(userSettings).where(eq(userSettings.userId, target));
  if (settings?.enabled === false) return;
  await db.insert(notifications).values({ userId: target, actorId: actor, kind, dedupeKey: key, reviewId }).onConflictDoNothing();
}

export async function limitAction(ctx: Context) {
  const now = Date.now();
  const result = await ctx.db.execute<{ count: number }>(sql`insert into rate_limits (key, count, last_request) values (${`action:${ctx.uid}`}, 1, ${now}) on conflict (key) do update set count = case when rate_limits.last_request < ${now - 60000} then 1 else rate_limits.count + 1 end, last_request = case when rate_limits.last_request < ${now - 60000} then ${now} else rate_limits.last_request end returning count`);
  must(result.rows[0].count <= 60, "Слишком много действий. Подожди минуту.");
}
