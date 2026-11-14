"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/session";
import { getDb } from "@/server/db";
import { user, userSettings } from "@/server/db/schema";
import { profileSchema } from "@/lib/validation";

export async function saveProfile(input: unknown): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Проверь имя, био и настройки приватности." };
  const { name, bio, ...settings } = parsed.data;
  try {
    await getDb().transaction(async (tx) => {
      await tx.update(user).set({ name, bio, updatedAt: new Date() }).where(eq(user.id, session.user.id));
      await tx.insert(userSettings).values({ userId: session.user.id, ...settings }).onConflictDoUpdate({ target: userSettings.userId, set: settings });
    });
  } catch { return { ok: false, message: "Не удалось сохранить изменения. Попробуй позже." }; }
  revalidatePath("/profile");
  return { ok: true, message: "Изменения сохранены." };
}
