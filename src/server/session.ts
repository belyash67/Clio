import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/server/auth";
import { isConfigured } from "@/server/config";
import { getDb } from "@/server/db";
import { user, userRoles } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function requireSession() {
  if (!isConfigured()) redirect("/login");
  const result = await getAuth().api.getSession({ headers: await headers() });
  if (!result || !result.user.emailVerified) redirect("/login");
  const [active] = await getDb().select({ blockedAt: user.blockedAt }).from(user).where(eq(user.id, result.user.id));
  if (!active || active.blockedAt) redirect("/login?blocked=1");
  return result;
}

export async function memberContext() {
  const session = await requireSession(); const db = getDb();
  const [role] = await db.select().from(userRoles).where(eq(userRoles.userId, session.user.id));
  return { db, uid: session.user.id, admin: role?.role === "admin" };
}
