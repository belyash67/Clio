import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("Укажи DATABASE_URL в .env.local.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  const result = await pool.query("SELECT current_database() AS name, to_regclass('public.users') IS NOT NULL AS migrated");
  console.log(`Подключение к БД работает. Миграции аккаунтов: ${result.rows[0].migrated ? "применены" : "ещё не применены"}.`);
} catch {
  console.error("Не удалось подключиться к PostgreSQL. Проверь службу, DATABASE_URL и порт. Пароль в чат не присылай.");
  process.exitCode = 1;
} finally { await pool.end(); }
