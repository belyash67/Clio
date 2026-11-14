import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, it, vi } from "vitest";
import * as schema from "../src/server/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown, messages: [] as { url: string; purpose: string }[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ getDb: () => state.db }));
// Only this isolated test intercepts mail. Production always uses the real SMTP adapter.
vi.mock("@/server/integrations/mail", () => ({ sendAuthMail: async (_to: string, url: string, purpose: string) => { state.messages.push({ url, purpose }); } }));

it("полный auth-сценарий работает в отдельной PostgreSQL-схеме", async () => {
  const namespace = `clio_test_${randomUUID().replaceAll("-", "")}`;
  if (!/^clio_test_[a-f0-9]{32}$/.test(namespace)) throw new Error("Invalid test namespace");
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let created = false;
  try {
    await client.connect();
    await client.query(`CREATE SCHEMA "${namespace}"`);
    created = true;
    await client.query(`SET search_path TO "${namespace}", public`);
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
    for (const { tag } of journal.entries) {
      const migration = await readFile(`drizzle/${tag}.sql`, "utf8");
      await client.query(migration.replaceAll('"public".', `"${namespace}".`));
    }
    state.db = drizzle(client, { schema });
    state.messages = [];
    const { getAuth } = await import("../src/server/auth");
    const auth = getAuth();
    const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const call = (path: string, body?: object, cookie?: string) => auth.handler(new Request(new URL(path, baseURL), {
      method: body ? "POST" : "GET",
      headers: { Origin: baseURL, ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
    const email = "auth-regression@example.invalid";
    const password = randomUUID();
    const registered = await call("/api/auth/sign-up/email", { name: "Regression", username: "auth_regression", email, password, role:"admin", personalBadge:true, callbackURL: "/login" });
    expect(registered.status).toBe(200);
    expect(state.messages.filter((item) => item.purpose === "verify")).toHaveLength(1);
    const beforeVerify = await call("/api/auth/sign-in/email", { email, password });
    expect(beforeVerify.status).toBe(403);
    expect((await beforeVerify.json()).code).toBe("EMAIL_NOT_VERIFIED");
    const resent = await call("/api/auth/send-verification-email", { email, callbackURL: "/login" });
    expect(resent.status).toBe(200);
    expect(state.messages.filter((item) => item.purpose === "verify")).toHaveLength(2);
    const verified = await call(state.messages.filter((item) => item.purpose === "verify").at(-1)!.url);
    expect([200, 302, 303]).toContain(verified.status);
    const signedIn = await call("/api/auth/sign-in/email", { email, password });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    expect(cookie.length).toBeGreaterThan(0);
    const session = await call("/api/auth/get-session", undefined, cookie);
    expect((await session.json()).user.emailVerified).toBe(true);
    const selfBadge=await call("/api/auth/update-user",{name:"Regression",personalBadge:true,role:"admin"},cookie);
    expect(selfBadge.status).toBe(400);
    expect((await client.query('SELECT personal_badge FROM users')).rows[0].personal_badge).toBe(false);
    expect((await call("/api/auth/update-user",{name:"Regression updated"},cookie)).status).toBe(200);
    const resetRequest = await call("/api/auth/request-password-reset", { email, redirectTo: "/reset-password" });
    expect(resetRequest.status).toBe(200);
    const resetMail = state.messages.find((item) => item.purpose === "reset");
    expect(resetMail).toBeDefined();
    const resetRedirect = await call(resetMail!.url);
    const token = new URL(resetRedirect.headers.get("location")!, baseURL).searchParams.get("token");
    expect(token).toBeTruthy();
    const newPassword = randomUUID();
    const reset = await call("/api/auth/reset-password", { token, newPassword });
    expect(reset.status).toBe(200);
    const revoked = await call("/api/auth/get-session", undefined, cookie);
    expect(await revoked.json()).toBeNull();
    const oldPasswordLogin = await call("/api/auth/sign-in/email", { email, password });
    expect(oldPasswordLogin.status).toBe(401);
    const newPasswordLogin = await call("/api/auth/sign-in/email", { email, password: newPassword });
    expect(newPasswordLogin.status).toBe(200);
    const reusedToken = await call("/api/auth/reset-password", { token, newPassword: randomUUID() });
    expect(reusedToken.status).toBe(400);
    const tables = await client.query('SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM accounts)::int AS accounts, (SELECT count(*) FROM sessions)::int AS sessions');
    expect(tables.rows[0]).toEqual({ users: 1, accounts: 1, sessions: 1 });
    expect((await client.query('SELECT count(*)::int AS count FROM user_roles')).rows[0].count).toBe(0);
    expect((await client.query('SELECT personal_badge FROM users')).rows[0].personal_badge).toBe(false);
    await client.query('UPDATE users SET blocked_at=now()');
    const blockedLogin=await call("/api/auth/sign-in/email",{email,password:newPassword});
    expect(blockedLogin.status).toBe(403);
  } finally {
    if (created) await client.query(`DROP SCHEMA "${namespace}" CASCADE`);
    await client.end();
  }
});
