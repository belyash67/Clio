import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { clioPool?: Pool };
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("Не задан DATABASE_URL.");
  const pool = globalDb.clioPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 });
  globalDb.clioPool = pool;
  return drizzle(pool, { schema });
}
