import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, it } from "vitest";

it("PostgreSQL создаёт ID ограничителя запросов, когда auth-адаптер не передаёт его", async () => {
  if (!process.env.DATABASE_URL) throw new Error("Для интеграционного теста нужен локальный DATABASE_URL.");
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query("BEGIN");
    const key = `clio-regression-test:${randomUUID()}`;
    const now = Date.now();
    const inserted = await client.query(
      'INSERT INTO rate_limits (key, count, last_request) VALUES ($1, $2, $3) RETURNING id, count, last_request',
      [key, 1, now],
    );
    expect(inserted.rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(Number(inserted.rows[0].last_request)).toBe(now);
    const updated = await client.query('UPDATE rate_limits SET count = count + 1 WHERE key = $1 RETURNING id, count', [key]);
    expect(updated.rows[0]).toEqual({ id: inserted.rows[0].id, count: 2 });
  } finally {
    // All test writes are rolled back; existing accounts and counters are untouched.
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
});
