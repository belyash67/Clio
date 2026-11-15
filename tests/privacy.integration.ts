import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, it, vi } from "vitest";
import * as schema from "../src/server/db/schema";
import { PRIVACY_VERSION } from "../src/lib/privacy";

const state = vi.hoisted(() => ({ db: null as unknown, uid: "" }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ getDb: () => state.db }));
vi.mock("@/server/session", () => ({ requireSession: async () => ({ user: { id: state.uid } }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

it("не приписывает согласие старым аккаунтам; отзыв удаляет только владельца сессии", async () => {
  const namespace = `clio_test_${randomUUID().replaceAll("-", "")}`;
  if (!/^clio_test_[a-f0-9]{32}$/.test(namespace)) throw new Error("Invalid namespace");
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let created = false;
  try {
    await client.connect(); await client.query(`CREATE SCHEMA "${namespace}"`); created = true;
    await client.query(`SET search_path TO "${namespace}", public`);
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
    for (const { tag } of journal.entries) {
      await client.query((await readFile(`drizzle/${tag}.sql`, "utf8")).replaceAll('"public".', `"${namespace}".`));
      if (tag.startsWith("0007_")) await client.query("INSERT INTO users(id,name,email,username,email_verified) VALUES ('legacy','Legacy','legacy@example.invalid','legacy',true),('other','Other','other@example.invalid','other',true)");
    }
    expect((await client.query('SELECT consent_version,consent_accepted_at,consent_snapshot FROM users')).rows).toEqual([
      { consent_version: null, consent_accepted_at: null, consent_snapshot: null }, { consent_version: null, consent_accepted_at: null, consent_snapshot: null },
    ]);
    state.db = drizzle(client, { schema }); state.uid = "legacy";
    const { confirmPrivacy, withdrawPrivacy } = await import("../src/modules/privacy/actions");
    expect((await confirmPrivacy({ processingConsent: true })).ok).toBe(false);
    expect((await confirmPrivacy({ processingConsent: true, transferConsent: true, privacyVersion: PRIVACY_VERSION, userId: "other" })).ok).toBe(true);
    const first = (await client.query("SELECT consent_accepted_at FROM users WHERE id='legacy'")).rows[0].consent_accepted_at;
    expect((await client.query("SELECT consent_accepted_at FROM users WHERE id='other'")).rows[0].consent_accepted_at).toBeNull();
    expect((await confirmPrivacy({ processingConsent: true, transferConsent: true, privacyVersion: PRIVACY_VERSION })).ok).toBe(true);
    expect((await client.query("SELECT consent_accepted_at FROM users WHERE id='legacy'")).rows[0].consent_accepted_at).toEqual(first);
    await client.query("INSERT INTO sessions(id,token,user_id,expires_at) VALUES ('s','test-session-token','legacy',now()+interval '1 hour')");
    await client.query("INSERT INTO verifications(id,identifier,value,expires_at) VALUES ('v','legacy@example.invalid','test-value',now()+interval '1 hour')");
    expect((await withdrawPrivacy(false)).ok).toBe(false);
    expect((await client.query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBe(2);
    expect((await withdrawPrivacy(true)).ok).toBe(true);
    expect((await client.query('SELECT id FROM users')).rows).toEqual([{ id: "other" }]);
    expect((await client.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n).toBe(0);
    expect((await client.query('SELECT count(*)::int AS n FROM verifications')).rows[0].n).toBe(0);
  } finally {
    if (created) await client.query(`DROP SCHEMA "${namespace}" CASCADE`);
    await client.end();
  }
});
