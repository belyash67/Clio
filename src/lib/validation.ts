import { z } from "zod";

export const visibilitySchema = z.enum(["private", "friends", "public"]);
export const usernameSchema = z.string().trim().toLowerCase().min(3).max(30)
  .regex(/^[a-z0-9_]+$/, "Используй латинские буквы, цифры и подчёркивание.");
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Укажи имя.").max(60),
  bio: z.string().trim().max(500),
  profileVisibility: z.enum(["friends", "public"]),
  libraryVisibility: visibilitySchema,
  activityVisibility: visibilitySchema,
}).strict();

export const registrationSchema = z.object({
  username: usernameSchema,
  name: z.string().trim().min(1).max(60),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(12).max(128),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"], message: "Пароли не совпадают.",
});
