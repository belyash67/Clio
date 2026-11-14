import "server-only";
import { eq } from "drizzle-orm";
import { comments, moderationActions, reports, reviews, session, user } from "@/server/db/schema";
import { type Context, id, value, must } from "@/modules/social/common";

export async function moderate(ctx: Context, data: FormData) {
  must(ctx.admin); const reportId = id(data, "reportId");
  const [report] = await ctx.db.select().from(reports).where(eq(reports.id, reportId)); must(report);
  const decision = value(data, "decision"); must(["resolve", "hide", "block", "restore", "unblock"].includes(decision));
  await ctx.db.transaction(async (tx) => {
    if (decision === "hide" || decision === "restore") {
      if (report.reviewId) await tx.update(reviews).set({ hidden: decision === "hide" }).where(eq(reviews.id, report.reviewId));
      else if (report.commentId) await tx.update(comments).set({ hidden: decision === "hide" }).where(eq(comments.id, report.commentId));
      else must(false, "В жалобе нет доступного контента.");
    } else if (decision === "block" || decision === "unblock") {
      let target = report.targetUserId;
      if (!target && report.reviewId) target = (await tx.select().from(reviews).where(eq(reviews.id, report.reviewId)))[0]?.userId;
      if (!target && report.commentId) target = (await tx.select().from(comments).where(eq(comments.id, report.commentId)))[0]?.userId;
      must(target && target !== ctx.uid, "Нельзя заблокировать себя.");
      await tx.update(user).set({ blockedAt: decision === "block" ? new Date() : null }).where(eq(user.id, target));
      if (decision === "block") await tx.delete(session).where(eq(session.userId, target));
    }
    await tx.update(reports).set({ resolved: true }).where(eq(reports.id, reportId));
    await tx.insert(moderationActions).values({ userId: ctx.uid, reportId, action: decision });
  });
}
