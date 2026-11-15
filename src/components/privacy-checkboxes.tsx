import Link from "next/link";
import { PRIVACY_VERSION, PROCESSING_CONSENT, TRANSFER_CONSENT } from "@/lib/privacy";

export function PrivacyCheckboxes() {
  return <fieldset className="privacy-consents"><legend>Данные и согласие</legend>
    <p>Прочитай <Link href="/privacy" target="_blank" rel="noopener" className="text-link">Политику конфиденциальности ↗</Link>. Версия {PRIVACY_VERSION}. Без этих подтверждений аккаунт не создаётся; каталог можно смотреть без регистрации.</p>
    <input type="hidden" name="privacyVersion" value={PRIVACY_VERSION}/>
    <label className="check-field"><input type="checkbox" name="processingConsent" required/><span>{PROCESSING_CONSENT}</span></label>
    <label className="check-field"><input type="checkbox" name="transferConsent" required/><span>{TRANSFER_CONSENT}</span></label>
    <p className="muted">Отзыв доступен в настройках. Он прекращает использование аккаунта в текущем размещении.</p>
  </fieldset>;
}
