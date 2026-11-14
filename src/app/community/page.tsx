import {Search,UserPlus,Users} from "lucide-react";
import {Sheet} from "@/components/mobile-ui";
import {SectionTabs} from "@/components/section-tabs";
import {Poster} from "@/modules/catalog/poster";
import {UserName} from "@/components/user-name";

import { LocalizedInput } from "@/components/i18n";

import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { memberContext } from "@/server/session";
import { ActionForm } from "@/components/action-form";
import { pageNumber, feedRows } from "@/modules/social/queries";
import { PageNav } from "@/components/social-ui";

export const metadata={title:"Сообщество"};
export default async function Community({searchParams}:{searchParams:Promise<{q?:string;page?:string;tab?:string}>}) {
  const ctx=await memberContext();const p=await searchParams;const page=pageNumber(p.page);const q=(p.q??"").trim().slice(0,60);
  const tab=p.tab==="friends"||p.tab==="search"?p.tab:p.q?"search":"feed";
  const people=tab==="search"?(await ctx.db.execute<{id:string;username:string;badge?:boolean;name:string}>(sql`select u.id,u.username,u.personal_badge as badge,u.name from users u join user_settings s on s.user_id=u.id where u.blocked_at is null and u.id<>${ctx.uid} and s.profile_visibility='public' and (u.username ilike ${`%${q}%`} or u.name ilike ${`%${q}%`}) order by u.username limit 24 offset ${(page-1)*24}`)).rows:[];
  const friends=(await ctx.db.execute<{id:string;username:string;badge?:boolean;status:string;requestedBy:string}>(sql`select u.id,u.username,u.personal_badge as badge,f.status,f.requested_by as "requestedBy" from friendships f join users u on u.id=case when f.low_id=${ctx.uid} then f.high_id else f.low_id end where (f.low_id=${ctx.uid} or f.high_id=${ctx.uid}) and u.blocked_at is null order by f.created_at desc limit 100`)).rows;
  const feed=tab==="feed"?await feedRows(ctx.uid,page):[];
  const requests=friends.filter(person=>person.status==="pending"&&person.requestedBy!==ctx.uid).length;
  return <div className="catalog-page"><div className="page-heading"><h1><I18nText text="Сообщество"/></h1></div>
    <SectionTabs active={tab} items={[{id:"feed",label:"Лента",href:"/community"},{id:"friends",label:"Друзья",href:"/community?tab=friends",count:requests},{id:"search",label:"Найти",href:"/community?tab=search"}]}/>
    {tab==="feed"&&<>{feed.map(entry=><article className="feed-item" key={entry.kind+":"+entry.id}><div className="card-heading"><UserName username={entry.username} badge={entry.badge}/><span className="muted">{new Date(entry.createdAt).toLocaleDateString("ru-RU")}</span></div><p className="feed-kind"><I18nText text={entry.kind==="review"?"Опубликовал(а) рецензию":entry.kind==="rating"?"Обновил(а) оценку":entry.kind==="collection"?"Обновил(а) коллекцию":"Записал(а) просмотр"}/></p><Link className="feed-title" href={entry.kind==="review"?"/reviews/"+entry.id:entry.kind==="collection"?"/collections/"+entry.id:"/catalog/"+entry.type+"/"+entry.tmdbId}>{entry.posterPath&&<Poster path={entry.posterPath} title={entry.title}/>}<h2>{entry.title}</h2></Link></article>)}{!feed.length&&<div className="empty-state"><Users size={35} aria-hidden/><h2><I18nText text="Кино интереснее с друзьями"/></h2><Link className="button primary" href="/community?tab=search"><I18nText text="Найти друзей"/></Link></div>}<PageNav base="/community" page={page} hasNext={feed.length===24}/></>}
    {tab==="friends"&&<>{[...friends].sort((a,b)=>Number(b.status==="pending"&&b.requestedBy!==ctx.uid)-Number(a.status==="pending"&&a.requestedBy!==ctx.uid)).map(person=><article className="person-row" key={person.id}><Link className="person-avatar" href={"/users/"+person.username} aria-label={person.username}>{person.username.slice(0,1).toUpperCase()}</Link><div className="person-info"><UserName username={person.username} badge={person.badge}/><span className="muted"><I18nText text={person.status==="accepted"?"Друзья":person.requestedBy===ctx.uid?"Запрос отправлен":"Входящий запрос"}/></span></div>{person.status==="pending"&&person.requestedBy!==ctx.uid&&<ActionForm op="friend-accept" fields={{targetId:person.id}} label="Принять"/>}<Sheet label="Управлять дружбой" iconOnly><p><UserName username={person.username} badge={person.badge}/></p><ActionForm op="friend-remove" fields={{targetId:person.id}} label={person.status==="accepted"?"Удалить из друзей":"Отменить / отклонить"} closeOnSuccess/></Sheet></article>)}{!friends.length&&<div className="empty-state"><p><I18nText text="Друзей и запросов пока нет."/></p><Link className="text-link" href="/community?tab=search"><I18nText text="Найти друзей"/></Link></div>}</>}
    {tab==="search"&&<><form className="search-bar" action="/community"><input type="hidden" name="tab" value="search"/><label><span className="sr-only"><I18nText text="Поиск людей"/></span><LocalizedInput name="q" defaultValue={q} maxLength={60} placeholder="Username или имя"/></label><button className="icon-button" aria-label="Найти"><Search size={21} aria-hidden/></button></form><div className="people-list">{people.map(person=>{const relation=friends.find(item=>item.id===person.id);return <article className="person-row" key={person.id}><Link className="person-avatar" href={"/users/"+person.username} aria-label={person.name}>{person.name.slice(0,1).toUpperCase()}</Link><div className="person-info"><Link href={"/users/"+person.username}><strong>{person.name}</strong></Link><UserName username={person.username} badge={person.badge}/></div>{relation?<span className="muted"><I18nText text={relation.status==="accepted"?"Друзья":"Запрос отправлен"}/></span>:<ActionForm op="friend-request" fields={{targetId:person.id}} label="Добавить в друзья" buttonContent={<UserPlus size={22} aria-hidden/>}/>}</article>;})}</div>{!people.length&&<div className="empty-state"><p><I18nText text="Открытых профилей по этому запросу нет."/></p></div>}<PageNav base="/community" query={{q,tab:"search"}} page={page} hasNext={people.length===24}/></>}
  </div>;
}
