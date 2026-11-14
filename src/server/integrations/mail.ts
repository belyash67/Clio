import "server-only";
import nodemailer from "nodemailer";
import { getConfig } from "@/server/config";
import { publicAccessPaused } from "@/lib/public-access";

export async function sendAuthMail(to: string, url: string, purpose: "verify" | "reset" | "change") {
  if (publicAccessPaused()) throw new Error("Account mail is disabled while public access is paused.");
  const env = getConfig();
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
    requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000, socketTimeout: 15000,
  });
  await transport.sendMail({
    from: env.SMTP_FROM, to,
    subject: purpose === "verify" ? "Подтвердите email в Clio" : purpose === "change" ? "Подтвердите смену email в Clio" : "Восстановление доступа к Clio",
    text: `${purpose === "verify" ? "Подтвердите свой email" : purpose === "change" ? "Подтвердите смену email" : "Задайте новый пароль"}:\n\n${url}\n\nЕсли вы не запрашивали это письмо, просто проигнорируйте его.`,
  });
}
