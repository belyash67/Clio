
import { I18nText } from "@/components/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteNavigation } from "@/components/site-navigation";
import {IconLink} from "@/components/mobile-ui";
import {PwaProvider} from "@/components/pwa-controls";
import { LanguageProvider } from "@/components/i18n";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = { title: { default: "Clio — твоя история кино", template: "%s · Clio" }, description: "Личное пространство для твоей истории кино.",appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"Clio"},icons:{apple:"/icons/icon-192.png"} };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale=(await cookies()).get("clio-language")?.value;const language=locale==="en"||locale==="de"?locale:"ru";
  return <html lang={language} suppressHydrationWarning><body><LanguageProvider language={language}><ThemeProvider><PwaProvider>
    <a href="#main" className="skip-link"><I18nText text={"Перейти к содержимому"}/></a>
    <header className="site-header"><Link href="/" className="brand" aria-label="Clio — главная"><Clapperboard size={23} aria-hidden /> clio<span className="brand-dot">.</span></Link><IconLink href="/notifications" label="Уведомления" icon="bell"/></header>
    <div className="app-shell"><SiteNavigation /><main id="main">{children}</main></div>
  </PwaProvider></ThemeProvider></LanguageProvider></body></html>;
}
