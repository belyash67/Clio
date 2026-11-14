import { readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function setup() {
  const contents = await readFile(".env.local", "utf8");
  const env = parse(contents);
  if (!env.POSTGRES_ADMIN_PASSWORD || env.POSTGRES_ADMIN_PASSWORD === "PASTE_PASSWORD_HERE") {
    throw new Error("Впиши пароль postgres в POSTGRES_ADMIN_PASSWORD в .env.local и сохрани файл. Пароль в чат не отправляй.");
  }
  const url = new URL(env.DATABASE_URL);
  if (url.hostname !== "127.0.0.1" || url.port !== "5432" || url.username !== "clio" || url.pathname !== "/clio") {
    throw new Error("Автонастройка рассчитана только на локальную базу clio и пользователя clio на 127.0.0.1:5432.");
  }
  const password = decodeURIComponent(url.password);
  if (!/^[a-f0-9]{64}$/.test(password)) {
    throw new Error("Автонастройка требует заранее сгенерированный локальный пароль приложения. Существующие пароли не меняются.");
  }
  const admin = new Client({ host: "127.0.0.1", port: 5432, user: "postgres", database: "postgres", password: env.POSTGRES_ADMIN_PASSWORD, connectionTimeoutMillis: 5000 });
  try {
    await admin.connect();
    const role = await admin.query("SELECT rolsuper, rolcreatedb, rolcreaterole, rolcanlogin FROM pg_roles WHERE rolname = $1", ["clio"]);
    if (!role.rowCount) {
      // Password is constrained above to generated hexadecimal characters, never arbitrary SQL.
      await admin.query(`CREATE ROLE clio LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
      console.log("Создан отдельный пользователь clio.");
    } else if (role.rows[0].rolsuper || role.rows[0].rolcreatedb || role.rows[0].rolcreaterole || !role.rows[0].rolcanlogin) {
      throw new Error("У существующей роли clio неподходящие права. Автоматически менять их не буду.");
    }
    const existing = await admin.query("SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1", ["clio"]);
    if (!existing.rowCount) {
      await admin.query("CREATE DATABASE clio OWNER clio");
      console.log("Создана база clio.");
    } else if (existing.rows[0].owner !== "clio") {
      throw new Error("База clio уже существует с другим владельцем. Её данные и владельца не меняю.");
    }
  } finally { await admin.end(); }

  const app = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await app.connect();
    await migrate(drizzle(app), { migrationsFolder: "./drizzle" });
    const result = await app.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'sessions', 'accounts', 'verifications', 'rate_limits', 'user_settings', 'user_roles')");
    if (result.rows[0].count !== 7) throw new Error("Проверка таблиц не пройдена.");
  } finally { await app.end(); }

  // Never retain the administrator password once bootstrap has succeeded.
  await writeFile(".env.local", contents.replace(/^POSTGRES_ADMIN_PASSWORD=.*(?:\r?\n|$)/m, ""), "utf8");
  console.log("Подключение Clio проверено, миграции применены. Пароль postgres удалён из .env.local; приложение использует отдельного пользователя clio.");
}

setup().catch((error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "28P01") console.error("Пароль PostgreSQL не подошёл. Проверь локальные настройки; существующие пароли не менялись.");
  else if (code) console.error(`Не удалось завершить настройку PostgreSQL (код ${code}). Секреты не выводятся.`);
  else console.error(error instanceof Error ? error.message : "Не удалось завершить локальную настройку.");
  process.exitCode = 1;
});
