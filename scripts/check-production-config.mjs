import { readFile } from "node:fs/promises";
import { parse } from "dotenv";

// Read only: never connects, sends email, changes flags, or prints env values.
const file = process.argv[2];
let env = process.env;
if (file) {
  try { env = parse(await readFile(file)); }
  catch { console.error("Не удалось прочитать файл окружения."); process.exitCode = 1; }
}
if (!process.exitCode) {
  const failures = [];
  const requireCheck = (condition, message) => { if (!condition) failures.push(message); };
  let origin, database;
  try { origin = new URL(env.BETTER_AUTH_URL); } catch { /* reported below */ }
  try { database = new URL(env.DATABASE_URL); } catch { /* reported below */ }
  requireCheck(origin?.protocol === "https:" && origin.pathname === "/" && !origin.search && !origin.hash && !origin.username && !origin.password, "BETTER_AUTH_URL: нужен чистый HTTPS origin.");
  requireCheck(database && ["postgres:", "postgresql:"].includes(database.protocol) && database.username && database.password && database.pathname.length > 1, "DATABASE_URL: нужна полная строка PostgreSQL.");
  requireCheck(database?.searchParams.get("sslmode") === "verify-full", "DATABASE_URL: требуется sslmode=verify-full и проверяемый сертификат сервера.");
  requireCheck(Boolean(env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 32 && !/change_me|example/i.test(env.BETTER_AUTH_SECRET)), "BETTER_AUTH_SECRET: нужен отдельный случайный секрет длиной от 32 символов.");
  for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "TMDB_READ_ACCESS_TOKEN"]) requireCheck(Boolean(env[name]?.trim()), `${name}: не заполнено.`);
  requireCheck(["465", "587"].includes(env.SMTP_PORT), "SMTP_PORT: нужен 465 или 587.");
  requireCheck(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SMTP_FROM || ""), "SMTP_FROM: нужен email отправителя.");
  requireCheck(!Object.keys(env).some(key => /^NEXT_PUBLIC_.*(SECRET|PASSWORD|TOKEN|DATABASE_URL|API_KEY)/i.test(key)), "Найдена потенциально секретная переменная NEXT_PUBLIC_*. Удалите её из клиентского окружения.");
  if (env.CLIO_PUBLIC_ACCOUNTS_ENABLED === "true") {
    const validDate = value => {
      const timestamp = Date.parse(value || "");
      return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value && value.endsWith(".000Z");
    };
    const start = Date.parse(env.CLIO_ACCESS_STARTS_AT || ""), end = Date.parse(env.CLIO_ACCESS_ENDS_AT || "");
    requireCheck(validDate(env.CLIO_ACCESS_STARTS_AT) && validDate(env.CLIO_ACCESS_ENDS_AT) && end > start && end - start <= 31 * 86400000 && end > Date.now(), "Для открытия нужны две корректные UTC-даты окна до 31 суток; окончание должно быть в будущем.");
  }
  for (const message of failures) console.error(`НЕ ГОТОВО: ${message}`);
  console.log(env.CLIO_PUBLIC_ACCOUNTS_ENABLED === "true" ? "Внимание: открытие аккаунтов включено в проверяемом файле." : "Открытие аккаунтов не включено в проверяемом файле.");
  console.log("Это проверка формата настроек, а не разрешение на запуск. Она не проверяет географию нового сервера, договоры, уведомления, документы, согласия и реальную доставку писем. См. docs/legal/launch-readiness.md.");
  if (failures.length) process.exitCode = 1;
  else console.log("Проверки формата пройдены; реальные подключения и условия запуска ещё нужно проверить.");
}
