"use client";
import Link from "next/link";
import {BadgeCheck} from "lucide-react";
import {useTranslate} from "@/components/i18n";

export function UserName({username,badge=false,link=true}:{username:string;badge?:boolean;link?:boolean}){
  const t=useTranslate();
  const content=<span className="user-name">@{username}{badge&&<span className="owner-badge" title={t("Создатель Clio")} aria-label={t("Создатель Clio")}><BadgeCheck size={18} aria-hidden/></span>}</span>;
  return link?<Link href={`/users/${username}`}>{content}</Link>:content;
}
