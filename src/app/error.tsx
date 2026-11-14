"use client";
import { I18nText } from "@/components/i18n";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="auth-layout"><h1><I18nText text={"Не удалось открыть страницу"}/></h1><p><I18nText text={"Проверь подключение к серверу и попробуй ещё раз."}/></p><button className="button primary" onClick={reset}><I18nText text={"Повторить"}/></button></div>;
}
