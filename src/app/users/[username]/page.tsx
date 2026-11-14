import Link from "next/link";
import {friendships} from "@/server/db/schema";
import {Sheet,IconLink} from "@/components/mobile-ui";
import {SectionTabs} from "@/components/section-tabs";
import {UserName} from "@/components/user-name";

import { I18nText } from "@/components/i18n";
import { sql,eq,and,or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { memberContext } from "@/server/session";
import { profileVisible } from "@/modules/social/policies";
import { libraryRows, visibleReviews, collectionRows, pageNumber } from "@/modules/social/queries";
import { MediaGrid, ReviewCard, CollectionCards, PageNav } from "@/components/social-ui";
import { ActionForm } from "@/components/action-form";

export default async function UserProfile({params,searchParams}:{params:Promise<{username:string;badge?:boolean}>;searchParams:Promise<{page?:string;tab?:string}>}) {
  const ctx=await memberContext();const username=(await params).username.toLowerCase();const p=await searchParams;const page=pageNumber(p.page);const tab=p.tab==="library"||p.tab==="collections"?p.tab:"reviews";
  const [owner]=(await ctx.db.execute<{id:string;username:string;badge?:boolean;name:string;bio:string;createdAt:Date;visibility:string}>(sql`select u.id,u.username,u.personal_badge as badge,u.name,u.bio,u.created_at as "createdAt",coalesce(s.profile_visibility,'private') as visibility from users u left join user_settings s on s.user_id=u.id where u.username=${username} and ${profileVisible(ctx.uid)}`)).rows;
  if(!owner)notFound();
  const entries=tab==="library"?await libraryRows(owner.id,ctx.uid,page):[];
  const reviews=tab==="reviews"?await visibleReviews(ctx.uid,{userId:owner.id},page):[];
  const collections=tab==="collections"?await collectionRows(owner.id,ctx.uid,page):[];
  const [relation]=await ctx.db.select({status:friendships.status,requestedBy:friendships.requestedBy}).from(friendships).where(or(and(eq(friendships.lowId,ctx.uid),eq(friendships.highId,owner.id)),and(eq(friendships.lowId,owner.id),eq(friendships.highId,ctx.uid))));
  return <div className="profile-page"><div className="page-heading"><IconLink href="/community" label="Назад" icon="back"/><span/>{owner.id!==ctx.uid&&owner.visibility==="public"&&<Sheet label="Действия с профилем" iconOnly><details><summary><I18nText text="Пожаловаться на профиль"/></summary><ActionForm op="report-create" fields={{targetUserId:owner.id}} label="Отправить"><textarea name="reason" required maxLength={1000}/></ActionForm></details></Sheet>}</div>
    <div className="identity"><span className="avatar-initial" aria-hidden>{owner.name.slice(0,1).toUpperCase()}</span><h1>{owner.name}</h1><UserName username={owner.username} badge={owner.badge} link={false}/>{owner.bio&&<p className="user-text">{owner.bio}</p>}</div>
    <div className="profile-relationship">{owner.id===ctx.uid?<Link className="button secondary" href="/settings?section=profile"><I18nText text="Редактировать профиль"/></Link>:relation?.status==="accepted"?<Link className="button secondary" href="/community?tab=friends"><I18nText text="Друзья"/></Link>:relation?.requestedBy===ctx.uid?<p className="muted"><I18nText text="Запрос отправлен"/></p>:relation?<ActionForm op="friend-accept" fields={{targetId:owner.id}} label="Принять"/>:<ActionForm op="friend-request" fields={{targetId:owner.id}} label="Добавить в друзья"/>}</div>
    <SectionTabs active={tab} items={[{id:"reviews",label:"Рецензии",href:"/users/"+owner.username},{id:"library",label:"Библиотека",href:"/users/"+owner.username+"?tab=library"},{id:"collections",label:"Коллекции",href:"/users/"+owner.username+"?tab=collections"}]}/>
    {tab==="library"&&<MediaGrid rows={entries}/>}
    {tab==="reviews"&&(reviews.length?reviews.map(row=><ReviewCard key={row.id} row={row} viewer={ctx.uid}/>):<p className="quiet-empty"><I18nText text="Нет доступных рецензий."/></p>)}
    {tab==="collections"&&<CollectionCards rows={collections}/>}
    <PageNav base={"/users/"+owner.username} page={page} query={{tab}} hasNext={entries.length===24||reviews.length===12||collections.length===24}/>
  </div>;
}
