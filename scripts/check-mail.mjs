import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import nodemailer from "nodemailer";

let transport;
try {
  const env = parse(await readFile(process.argv[2] || ".env.local", "utf8"));
  if (env.SMTP_HOST !== "smtp.gmail.com" || !["465", "587"].includes(env.SMTP_PORT)) {
    throw new Error("INVALID_CONFIG");
  }
  if (!env.SMTP_USER || !env.SMTP_PASSWORD?.trim()) {
    console.error("Не заполнены SMTP_USER или SMTP_PASSWORD в выбранном файле. Укажите пароль приложения именно для выбранного почтового аккаунта.");
    throw new Error("MISSING_CREDENTIALS");
  }
  transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: env.SMTP_PORT === "465",
    requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.verify();
  console.log("Gmail SMTP: защищённое подключение и авторизация успешны. Письмо не отправлялось.");
} catch (error) {
  // SMTP errors may contain account identifiers: never print raw errors.
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "CONFIG";
  const allowed = new Set(["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "CONFIG"]);
  console.error(`Gmail SMTP: проверка не пройдена (${allowed.has(code) ? code : "SMTP_ERROR"}). Секреты не выводятся.`);
  process.exitCode = 1;
} finally {
  transport?.close();
}
