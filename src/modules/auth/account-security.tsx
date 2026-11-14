"use client";
import { I18nText } from "@/components/i18n";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AccountSecurity() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return <section><h2><I18nText text={"Безопасность аккаунта"}/></h2>
    <form aria-busy={pending} onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const value = (name: string) => String(data.get(name) ?? "");
      if (value("newPassword") !== value("confirmation")) { setMessage("Пароли не совпадают."); return; }
      setPending(true); setMessage("");
      try {
        const result = await authClient.changePassword({ currentPassword: value("currentPassword"), newPassword: value("newPassword"), revokeOtherSessions: true });
        setMessage(result.error ? "Не удалось изменить пароль. Проверь текущий пароль и попробуй снова." : "Пароль изменён, остальные сессии завершены.");
        if (!result.error) form.reset();
      } catch { setMessage("Не удалось связаться с сервером."); }
      finally { setPending(false); }
    }}>
      <label className="field"><I18nText text={"Текущий пароль"}/><input name="currentPassword" type="password" required autoComplete="current-password" maxLength={128} /></label>
      <label className="field"><I18nText text={"Новый пароль"}/><input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <label className="field"><I18nText text={"Повтори новый пароль"}/><input name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <button className="button primary" disabled={pending}><I18nText text={"Изменить пароль"}/></button>
    </form>
    <p className="muted"><I18nText text={"При смене пароля остальные сессии завершаются автоматически. Их также можно завершить отдельно."}/></p>
    <button className="button secondary" disabled={pending} onClick={async () => {
      setPending(true); setMessage("");
      try {
        const result = await authClient.revokeOtherSessions();
        setMessage(result.error ? "Не удалось завершить сессии." : "Все остальные сессии завершены.");
      } catch { setMessage("Не удалось связаться с сервером."); }
      finally { setPending(false); }
    }}><I18nText text={"Выйти на остальных устройствах"}/></button>
    {message && <p className="feedback" role="status"><I18nText text={message}/></p>}
  </section>;
}
