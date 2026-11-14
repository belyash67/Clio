import {Sheet,MenuLink} from "@/components/mobile-ui";
import {SectionTabs} from "@/components/section-tabs";
import {Search,BookOpen} from "lucide-react";

import { I18nText,LocalizedInput } from "@/components/i18n";
import Link from "next/link";
import { memberContext } from "@/server/session";
import { libraryRows, pageNumber } from "@/modules/social/queries";
import { MediaGrid, PageNav, statusLabels } from "@/components/social-ui";

export const metadata = {title:"Моя библиотека"};
export default async function Library({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const ctx=await memberContext();const p=await searchParams;const page=pageNumber(p.page);
  const rows=await libraryRows(ctx.uid,ctx.uid,page,p.q??"",p.status??"",p.favorites==="1",p.sort??"recent");
  const tab=p.favorites==="1"?"favorites":p.status||"all";
  const tabHref=(status="",favorite=false)=>"/library?"+new URLSearchParams({q:p.q??"",sort:p.sort??"recent",status,favorites:favorite?"1":""});
  return <div className="catalog-page"><div className="page-heading"><h1><I18nText text="Библиотека"/></h1><Sheet label="Ещё" title="Моё кино" iconOnly><div className="menu-list"><MenuLink href="/collections" label="Коллекции" icon="collections"/><MenuLink href="/diary" label="Кинодневник" icon="diary"/><MenuLink href="/ratings" label="Мои оценки" icon="star"/><MenuLink href="/stats" label="Статистика" icon="stats"/></div></Sheet></div>
    <SectionTabs active={tab} items={[{id:"all",label:"Все",href:tabHref()},{id:"watching",label:"Смотрю",href:tabHref("watching")},{id:"later",label:"Позже",href:tabHref("later")},{id:"watched",label:"Просмотрено",href:tabHref("watched")},{id:"favorites",label:"Избранное",href:tabHref("",true)}]}/>
    <div className="search-tools"><form action="/library" className="search-bar"><label><span className="sr-only"><I18nText text="Поиск"/></span><LocalizedInput name="q" defaultValue={p.q} maxLength={120} placeholder="Поиск в библиотеке"/></label><input name="status" value={p.status??""} type="hidden"/><input name="favorites" value={p.favorites??""} type="hidden"/><input name="sort" value={p.sort??"recent"} type="hidden"/><button className="icon-button" aria-label="Найти"><Search size={21} aria-hidden/></button></form>
      <Sheet label="Фильтры" icon="filters" iconOnly><form action="/library" className="filter-form"><input name="q" value={p.q??""} type="hidden"/><label className="field"><I18nText text="Статус"/><select name="status" defaultValue={p.status??""}><option value=""><I18nText text="Все"/></option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}><I18nText text={label}/></option>)}</select></label><label className="field"><I18nText text="Сортировка"/><select name="sort" defaultValue={p.sort??"recent"}><option value="recent"><I18nText text="Недавно изменённые"/></option><option value="title"><I18nText text="Название"/></option><option value="rating"><I18nText text="Моя оценка"/></option><option value="status"><I18nText text="Статус"/></option></select></label><label className="check-field"><input name="favorites" value="1" type="checkbox" defaultChecked={p.favorites==="1"}/><I18nText text="Избранное"/></label><button className="button primary"><I18nText text="Показать"/></button></form></Sheet>
    </div>
    {rows.length?<MediaGrid rows={rows}/>:<div className="empty-state"><BookOpen size={35} aria-hidden/><h2><I18nText text="Здесь будет твоё кино"/></h2><Link className="button primary" href="/catalog"><I18nText text="Найти фильм"/></Link></div>}
    <PageNav page={page} hasNext={rows.length===24} base="/library" query={{q:p.q??"",status:p.status??"",favorites:p.favorites??"",sort:p.sort??"recent"}}/>
  </div>;
}
