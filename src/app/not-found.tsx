
import { I18nText } from "@/components/i18n";
import Link from "next/link";
export default function NotFound() {
  return <div className="auth-layout"><span className="eyebrow">404</span><h1><I18nText text={"Этой страницы нет"}/></h1><Link className="button primary" href="/"><I18nText text={"На главную"}/></Link></div>;
}
