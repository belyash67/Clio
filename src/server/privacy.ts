import "server-only";
import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { user, verification } from "@/server/db/schema";
import { PRIVACY_VERSION, privacyEvidence, validPrivacyConsent } from "@/lib/privacy";

// userId is obtained from the authenticated session by the Server Action, never its input.
export async function confirmAccountPrivacy(userId: string, input: unknown) {
  if (!validPrivacyConsent(input)) return { ok: false, message: "Отметь оба подтверждения актуальной политики." };
  const updated = await getDb().update(user).set(privacyEvidence()).where(and(eq(user.id, userId), isNull(user.consentAcceptedAt))).returning({ id: user.id });
  if (updated.length) return { ok: true, message: "Твоё подтверждение сохранено." };
  const [existing] = await getDb().select({ version: user.consentVersion }).from(user).where(eq(user.id, userId));
  return existing?.version === PRIVACY_VERSION
    ? { ok: true, message: "Эта версия уже подтверждена. Дата не изменена." }
    : { ok: false, message: "Не удалось записать подтверждение. Свяжись с ответственным за проект." };
}

export async function withdrawAccountPrivacy(userId: string, confirmed: unknown) {
  if (confirmed !== true) return { ok: false, message: "Подтверди удаление аккаунта после отзыва." };
  await getDb().transaction(async tx => {
    const [owner] = await tx.select({ email: user.email }).from(user).where(eq(user.id, userId)).for("update");
    if (!owner) return;
    await tx.delete(verification).where(or(eq(verification.identifier, owner.email), eq(verification.value, userId)));
    await tx.delete(user).where(eq(user.id, userId));
  });
  return { ok: true, message: "Согласие отозвано. Аккаунт удалён из рабочей базы." };
}
