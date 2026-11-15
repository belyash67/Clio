import Link from "next/link";
import { PRIVACY_CONTACT, PRIVACY_SECTIONS, PRIVACY_VERSION, PROCESSING_CONSENT, TRANSFER_CONSENT } from "@/lib/privacy";

export const metadata = { title: "Политика конфиденциальности" };
export default function PrivacyPage() {
  return <article className="privacy-page"><Link href="/" className="text-link">← Clio</Link><h1>Политика конфиденциальности</h1>
    <p className="muted">Версия {PRIVACY_VERSION} · 14 ноября 2026</p>
    <p className="notice">Учебный проект для друзей из Кыргызстана. Приложение и база данных хранятся на сервере alwaysdata во Франции.</p>
    {PRIVACY_SECTIONS.map(section => <section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}
    <section><h2>Текст подтверждений</h2><p>{PROCESSING_CONSENT}</p><p>{TRANSFER_CONSENT}</p><p>Просмотр этой страницы сам по себе не означает согласия. Подтверждения отмечаются отдельно при регистрации или в настройках.</p></section>
    <p><Link className="button secondary" href="/settings?section=privacy">Данные, согласие и удаление</Link></p>
    <p>Связаться: <a className="text-link" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a></p>
  </article>;
}
