import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { getConfig } from "@/server/config";
import { getDb } from "@/server/db";
import * as schema from "@/server/db/schema";
import { sendAuthMail } from "@/server/integrations/mail";
import { usernameSchema } from "@/lib/validation";
import { eq, or } from "drizzle-orm";

function createAuth() {
  const env = getConfig();
  const db = getDb();
  return betterAuth({
    appName: "Clio",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(env.BETTER_AUTH_URL).origin],
    // Database errors can contain personal fields or password hashes. Do not log raw arguments.
    logger: {level:"error",log:(level)=>{if(level==="error")console.error("Clio auth: internal authentication error (details withheld).");}},
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    emailAndPassword: {
      enabled: true, minPasswordLength: 12, maxPasswordLength: 128,
      requireEmailVerification: true, autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => { await sendAuthMail(user.email, url, "reset"); },
    },
    emailVerification: {
      sendOnSignUp: true, sendOnSignIn: false, autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => { await sendAuthMail(user.email, url, "verify"); },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    user: {
      additionalFields: { bio: { type: "string", defaultValue: "", input: false }, personalBadge:{type:"boolean",defaultValue:false,input:false} },
      changeEmail: { enabled: true, sendChangeEmailConfirmation: async ({user,url}) => { await sendAuthMail(user.email,url,"change"); } },
      deleteUser: { enabled: true, beforeDelete: async (user) => { await db.delete(schema.verification).where(or(eq(schema.verification.identifier,user.email),eq(schema.verification.value,user.id))); } },
    },
    advanced: {
      database: { generateId: "uuid" },
      ipAddress: { ipAddressHeaders: [] },
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    rateLimit: {
      enabled: true, storage: "database", window: 60, max: 60,
      customRules: {
        "/sign-up/email": { window: 60, max: 3 },
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
    databaseHooks: { session: { create: { before: async (value) => {
      const [account] = await db.select({blockedAt:schema.user.blockedAt}).from(schema.user).where(eq(schema.user.id,value.userId));
      if (!account || account.blockedAt) throw new APIError("FORBIDDEN",{message:"Аккаунт недоступен."});
      return {data:value};
    } } }, user: {
      create: { before: async (value) => {
        const parsedUsername = usernameSchema.safeParse((value as typeof value & { username?: string }).username);
        if (!parsedUsername.success || !value.name.trim() || value.name.trim().length > 60) {
          throw new APIError("BAD_REQUEST", { message: "Проверь имя и username." });
        }
        return { data: { ...value, email: value.email.trim().toLowerCase(), name: value.name.trim(), username: parsedUsername.data } };
      } },
      update: { before: async (value) => {
        if (value.name !== undefined && (!value.name.trim() || value.name.trim().length > 60)) {
          throw new APIError("BAD_REQUEST", { message: "Имя должно содержать от 1 до 60 символов." });
        }
        return { data: { ...value, ...(value.email ? { email: value.email.trim().toLowerCase() } : {}) } };
      } },
    } },
    plugins: [username({
      minUsernameLength: 3, maxUsernameLength: 30,
      usernameValidator: (value) => usernameSchema.safeParse(value).success,
      usernameNormalization: (value) => value.trim().toLowerCase(),
    })],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
