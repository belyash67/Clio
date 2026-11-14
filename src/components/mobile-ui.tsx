"use client";

import {useEffect,useId,useRef} from "react";
import Link from "next/link";
import {Bell,Settings,SlidersHorizontal,MoreHorizontal,Bookmark,Star,PenLine,X,ChevronRight,ArrowLeft,Search,BookOpen,CalendarDays,ChartNoAxesCombined,FolderHeart,Shield,Palette,UserRound,LockKeyhole,Mail,Smartphone,Languages} from "lucide-react";
import {useTranslate} from "./i18n";

const icons={back:ArrowLeft,bell:Bell,settings:Settings,filters:SlidersHorizontal,more:MoreHorizontal,bookmark:Bookmark,star:Star,review:PenLine,search:Search,library:BookOpen,diary:CalendarDays,stats:ChartNoAxesCombined,collections:FolderHeart,admin:Shield,appearance:Palette,profile:UserRound,security:LockKeyhole,email:Mail,app:Smartphone,language:Languages};
type IconName=keyof typeof icons;

export function IconLink({href,label,icon}:{href:string;label:string;icon:IconName}){
  const t=useTranslate();const Icon=icons[icon];
  return <Link className="icon-button" href={href} aria-label={t(label)} title={t(label)}><Icon size={22} aria-hidden/></Link>;
}

export function MenuLink({href,label,icon}:{href:string;label:string;icon:IconName}){
  const t=useTranslate();const Icon=icons[icon];
  return <Link className="menu-link" href={href}><Icon size={20} aria-hidden/><span>{t(label)}</span><ChevronRight size={18} aria-hidden/></Link>;
}

export function Sheet({label,title,icon="more",iconOnly=false,badge,children,className="",value,hash}:{label:string;title?:string;icon?:IconName;iconOnly?:boolean;badge?:number;children:React.ReactNode;className?:string;value?:string;hash?:string}){
  const t=useTranslate();const dialog=useRef<HTMLDialogElement>(null);const heading=useId();const Icon=icons[icon];
  useEffect(()=>{const element=dialog.current;const close=()=>element?.close();element?.addEventListener("clio:saved",close);return()=>element?.removeEventListener("clio:saved",close);},[]);
  useEffect(()=>{if(!hash)return;const open=()=>{if(window.location.hash==="#"+hash&&!dialog.current?.open)dialog.current?.showModal();};open();window.addEventListener("hashchange",open);return()=>window.removeEventListener("hashchange",open);},[hash]);
  return <><button type="button" className={`${iconOnly?"icon-button":"sheet-trigger"} ${className}`} aria-label={t(label)+(value?": "+t(value):"")} onClick={()=>dialog.current?.showModal()}><Icon size={21} aria-hidden/>{!iconOnly&&<span>{t(value??label)}</span>}{Boolean(badge)&&<span className="filter-count">{badge}</span>}</button>
    <dialog ref={dialog} className="sheet-dialog" aria-labelledby={heading} onClose={()=>{if(hash&&window.location.hash==="#"+hash)window.history.replaceState(window.history.state,"",window.location.pathname+window.location.search);}} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <div className="sheet-surface"><span className="sheet-handle" aria-hidden/><header className="sheet-heading"><h2 id={heading}>{t(title??label)}</h2><button className="icon-button" type="button" aria-label={t("Закрыть")} onClick={()=>dialog.current?.close()}><X size={22} aria-hidden/></button></header><div className="sheet-content" onClick={event=>{if(event.target instanceof Element&&event.target.closest("a"))dialog.current?.close();}}>{children}</div></div>
    </dialog>
  </>;
}
