import Link from "next/link";
import {sql} from "drizzle-orm";
import { eq } from "drizzle-orm";
import { user } from "@/server/db/schema";
import {memberContext} from "@/server/session";
import {UserName} from "@/components/user-name";
import {I18nText} from "@/components/i18n";
import {IconLink,MenuLink,Sheet} from "@/components/mobile-ui";
import {SectionTabs} from "@/components/section-tabs";
import {ReviewCard,CollectionCards,MediaGrid,PageNav} from "@/components/social-ui";
import {visibleReviews,collectionRows,libraryRows,pageNumber} from "@/modules/social/queries";

export const dynamic="force-dynamic";
export default async function Profile({searchParams}:{searchParams:Promise<{tab?:string;page?:string}>}){
  const ctx=await memberContext();const p=await searchParams;const page=pageNumber(p.page);const tab=p.tab==="collections"||p.tab==="favorites"?p.tab:"reviews";
  const [privacy] = await ctx.db.select({ acceptedAt: user.consentAcceptedAt }).from(user).where(eq(user.id, ctx.uid));
  const [profile]=(await ctx.db.execute<{name:string;username:string;bio:string;badge:boolean;watched:number;ratings:number;friends:number}>(sql`select u.name,u.username,u.bio,u.personal_badge as badge,(select count(*)::int from user_library where user_id=u.id and status='watched') as watched,(select count(*)::int from ratings where user_id=u.id) as ratings,(select count(*)::int from friendships where (low_id=u.id or high_id=u.id) and status='accepted') as friends from users u where u.id=${ctx.uid}`)).rows;
  const reviews=tab==="reviews"?await visibleReviews(ctx.uid,{userId:ctx.uid},page):[];
  const collections=tab==="collections"?await collectionRows(ctx.uid,ctx.uid,page):[];
  const favorites=tab==="favorites"?await libraryRows(ctx.uid,ctx.uid,page,"","",true):[];
  return <div className="profile-page"><div className="page-heading"><h1><I18nText text="Профиль"/></h1><div className="inline-actions"><Sheet label="Ещё" title="Моё кино" iconOnly><div className="menu-list"><MenuLink href="/diary" label="Кинодневник" icon="diary"/><MenuLink href="/ratings" label="Мои оценки" icon="star"/><MenuLink href="/stats" label="Статистика" icon="stats"/>{ctx.admin&&<MenuLink href="/admin" label="Модерация" icon="admin"/>}</div></Sheet><IconLink href="/settings" label="Настройки" icon="settings"/></div></div>
    {!privacy?.acceptedAt&&<p className="notice">Мы добавили информацию об обработке данных. <Link className="text-link" href="/settings?section=privacy">Прочитать и подтвердить</Link></p>}
    <div className="identity"><span className="avatar-initial" aria-hidden>{profile.name.slice(0,1).toUpperCase()}</span><h2>{profile.name}</h2><UserName username={profile.username} badge={profile.badge} link={false}/>{profile.bio&&<p className="user-text">{profile.bio}</p>}</div>
    <div className="profile-counts"><Link href="/stats"><strong>{profile.watched}</strong><span><I18nText text="Просмотрено"/></span></Link><Link href="/ratings"><strong>{profile.ratings}</strong><span><I18nText text="Оценок"/></span></Link><Link href="/community?tab=friends"><strong>{profile.friends}</strong><span><I18nText text="Друзья"/></span></Link></div>
    <Link className="button secondary profile-edit" href="/settings?section=profile"><I18nText text="Редактировать профиль"/></Link>
    <SectionTabs active={tab} items={[{id:"reviews",label:"Рецензии",href:"/profile"},{id:"collections",label:"Коллекции",href:"/profile?tab=collections"},{id:"favorites",label:"Избранное",href:"/profile?tab=favorites"}]}/>
    {tab==="reviews"&&(reviews.length?reviews.map(row=><ReviewCard key={row.id} row={row} viewer={ctx.uid}/>):<div className="empty-state"><p><I18nText text="Твои впечатления о кино появятся здесь."/></p><Link className="text-link" href="/catalog"><I18nText text="Найти фильм"/></Link></div>)}
    {tab==="collections"&&<><CollectionCards rows={collections}/><Link className="button secondary" href="/collections"><I18nText text="Мои коллекции"/></Link></>}
    {tab==="favorites"&&<MediaGrid rows={favorites}/>}
    <PageNav base="/profile" page={page} query={{tab}} hasNext={reviews.length===12||collections.length===24||favorites.length===24}/>
  </div>;
}
