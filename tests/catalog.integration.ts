import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { expect, it } from "vitest";

it("сохраняет разные movie/tv с одинаковым TMDB ID и кэш в PostgreSQL", async () => {
  const namespace = `clio_test_${randomUUID().replaceAll("-", "")}`;
  if (!/^clio_test_[a-f0-9]{32}$/.test(namespace)) throw new Error("Invalid namespace");
  const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let created = false;
  try {
    await db.connect(); await db.query(`CREATE SCHEMA "${namespace}"`); created = true;
    await db.query(`SET search_path TO "${namespace}", public`);
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
    for (const { tag } of journal.entries) await db.query((await readFile(`drizzle/${tag}.sql`, "utf8")).replaceAll('"public".', `"${namespace}".`));
    const result = await db.query("INSERT INTO media (tmdb_media_type, tmdb_id, original_title) VALUES ('movie', 1, 'Test movie'), ('tv', 1, 'Test series') RETURNING id");
    expect(result.rows[0].id).not.toBe(result.rows[1].id);
    await expect(db.query("INSERT INTO media (tmdb_media_type, tmdb_id, original_title) VALUES ('movie', 1, 'Duplicate')")).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("INSERT INTO media (tmdb_media_type, tmdb_id, original_title) VALUES ('person', 1, 'Invalid')")).rejects.toMatchObject({ code: "23514" });
    await db.query("INSERT INTO catalog_cache (key, payload, fetched_at, expires_at) VALUES ($1, $2, now(), now() + interval '15 minutes')", ["test:ru", JSON.stringify({ test: true })]);
    const saved = await db.query("SELECT payload, expires_at > fetched_at AS valid FROM catalog_cache WHERE key = $1", ["test:ru"]);
    expect(saved.rows[0]).toEqual({ payload: { test: true }, valid: true });
  } finally { if (created) await db.query(`DROP SCHEMA "${namespace}" CASCADE`); await db.end(); }
});
