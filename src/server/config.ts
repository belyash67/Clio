import "server-only";
import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:/.test(value)),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().refine((value) => value === 465 || value === 587),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.email(),
});

export function getConfig() {
  const result = configSchema.safeParse(process.env);
  if (!result.success) throw new Error("Не заполнены настройки сервера. См. .env.example и docs/local-setup.md.");
  if (process.env.NODE_ENV === "production" && !result.data.BETTER_AUTH_URL.startsWith("https://")) {
    throw new Error("Для опубликованной версии нужен HTTPS.");
  }
  return result.data;
}

export function isConfigured() {
  return configSchema.safeParse(process.env).success;
}
