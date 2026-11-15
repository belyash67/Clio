"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrivacyCheckboxes } from "@/components/privacy-checkboxes";
import { PRIVACY_CONTACT } from "@/lib/privacy";
import { confirmPrivacy, withdrawPrivacy } from "./actions";

export function PrivacySettings({ version, acceptedAt }: { version: string | null; acceptedAt: string | null }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const router = useRouter();
  return <section><h2>Данные и согласие</h2><p><Link href="/privacy" className="text-link">Политика конфиденциальности</Link></p>
    {acceptedAt ? <p>Подтверждена версия {version}. Дата: <time dateTime={acceptedAt}>{new Date(acceptedAt).toLocaleString("ru-RU", { timeZone: "Asia/Bishkek" })}</time> (Бишкек).</p>
      : <><p>Для этого аккаунта подтверждение ещё не записано. Мы не добавляем его автоматически.</p><form aria-busy={pending} onSubmit={async event => {
        event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setMessage("");
        try { const result = await confirmPrivacy({ processingConsent: data.has("processingConsent"), transferConsent: data.has("transferConsent"), privacyVersion: data.get("privacyVersion") }); setMessage(result.message); if (result.ok) router.refresh(); }
        catch { setMessage("Не удалось связаться с сервером."); } finally { setPending(false); }
      }}><PrivacyCheckboxes/><button className="button primary" disabled={pending}>Подтвердить</button></form></>}
    <div className="danger-zone"><h3>Отзыв согласия</h3><p>Отзыв прекращает работу аккаунта: данные хранятся за рубежом. Аккаунт, библиотека и публикации будут удалены из рабочей базы. Уничтожение резервных копий у провайдера не происходит мгновенно.</p>
      {!showWithdrawal ? <button type="button" className="button secondary" onClick={() => setShowWithdrawal(true)}>Отозвать согласие</button>
        : <form aria-busy={pending} onSubmit={async event => { event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setMessage("");
          try { const result = await withdrawPrivacy(data.has("confirmWithdrawal")); setMessage(result.message); if (result.ok) { window.location.replace("/privacy?withdrawn=1"); return; } }
          catch { setMessage("Не удалось связаться с сервером. Проверь состояние аккаунта перед повторной попыткой."); } finally { setPending(false); }
        }}><label className="check-field"><input type="checkbox" name="confirmWithdrawal" required/><span>Понимаю, что мой аккаунт и его данные будут удалены без возможности восстановления через сайт.</span></label><button className="button danger" disabled={pending}>Отозвать согласие и удалить аккаунт</button><button type="button" className="button secondary" disabled={pending} onClick={() => setShowWithdrawal(false)}>Отмена</button></form>}
    </div>
    {message && <p role="status" className="feedback">{message}</p>}
    <p className="muted">Без входа или после завершения работы проекта: <a className="text-link" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.</p>
  </section>;
}
