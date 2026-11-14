"use client";
import { LocalizedNav } from "@/components/i18n";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Film, UserRound, BookOpen, Users } from "lucide-react";
import { I18nText } from "@/components/i18n";

export function SiteNavigation() {
  const pathname = usePathname();
  return <LocalizedNav className="site-navigation" aria-label="Основная навигация">{[
    { href: "/", label: "Главная", Icon: House,paths:["/"] }, { href: "/catalog", label: "Каталог", Icon: Film,paths:["/catalog","/people"] }, {href:"/library",label:"Библиотека",Icon:BookOpen,paths:["/library","/collections","/ratings","/diary","/stats"]},{href:"/community",label:"Сообщество",Icon:Users,paths:["/community","/users","/reviews","/notifications"]},{ href: "/profile", label: "Профиль", Icon: UserRound,paths:["/profile","/settings","/admin","/login","/register","/verify","/forgot-password","/reset-password"] },
  ].map(({ href, label, Icon,paths }) => {
    const active = paths.some(path=>path==="/"?pathname==="/":pathname===path||pathname.startsWith(path+"/"));
    return <Link href={href} key={href} aria-current={active ? "page" : undefined}><Icon size={19} aria-hidden /><span><I18nText text={label}/></span></Link>;
  })}</LocalizedNav>;
}
