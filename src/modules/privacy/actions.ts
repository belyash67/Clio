"use server";
import { requireSession } from "@/server/session";
import { confirmAccountPrivacy, withdrawAccountPrivacy } from "@/server/privacy";
import { revalidatePath } from "next/cache";

export async function confirmPrivacy(input: unknown) {
  const session = await requireSession();
  try {
    const result = await confirmAccountPrivacy(session.user.id, input);
    revalidatePath("/settings"); revalidatePath("/profile");
    return result;
  } catch { return { ok: false, message: "Не удалось сохранить подтверждение. Попробуй позже." }; }
}
export async function withdrawPrivacy(confirmed: unknown) {
  const session = await requireSession();
  try {
    const result = await withdrawAccountPrivacy(session.user.id, confirmed);
    revalidatePath("/", "layout");
    return result;
  } catch { return { ok: false, message: "Не удалось завершить удаление. Попробуй позже или напиши на контакт из политики." }; }
}
