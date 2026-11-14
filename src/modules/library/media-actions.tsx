import {Sheet} from "@/components/mobile-ui";

import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { library, ratings, reviews, collections, user,userRoles,media } from "@/server/db/schema";
import { ActionForm } from "@/components/action-form";
import { ReviewCard, VisibilitySelect } from "@/components/social-ui";
import { visibleReviews } from "@/modules/social/queries";

export async function MediaActions({ mediaId }: { mediaId: string }) {
  const db = getDb();
  const auth = await getAuth().api.getSession({ headers: await headers() });
  const [aggregate] = (await db.execute<{ average: string|null; count: number; weighted: string|null }>(sql`select avg(r.score)/2 as average,count(*)::int as count,(sum(r.score::numeric/2)+10*(select avg(score::numeric/2) from ratings))/(count(*)+10) as weighted from ratings r join users u on u.id=r.user_id where r.media_id=${mediaId} and u.blocked_at is null`)).rows;
  if (!auth?.user.emailVerified) return <section className="social-section"><h2><I18nText text={"Рейтинг Clio"}/></h2><p>{aggregate.count ? `${Number(aggregate.average).toFixed(1)} / 10 · ${aggregate.count} оценок` : <I18nText text={"Оценок пока нет"}/>}</p><Link className="button primary" href="/login"><I18nText text={"Войти, чтобы добавить в библиотеку"}/></Link></section>;
  const uid = auth.user.id;
  const [account] = await db.select({ blockedAt: user.blockedAt }).from(user).where(eq(user.id, uid));
  if (!account || account.blockedAt) return null;
  const [role]=await db.select().from(userRoles).where(eq(userRoles.userId,uid));
  const [catalogEntry]=await db.select().from(media).where(eq(media.id,mediaId));
  const [[entry], [rating], [review], lists, reviewRows] = await Promise.all([
    db.select().from(library).where(and(eq(library.userId, uid), eq(library.mediaId, mediaId))),
    db.select().from(ratings).where(and(eq(ratings.userId, uid), eq(ratings.mediaId, mediaId))),
    db.select().from(reviews).where(and(eq(reviews.userId, uid), eq(reviews.mediaId, mediaId))),
    db.select().from(collections).where(eq(collections.userId, uid)).limit(100), visibleReviews(uid, { mediaId }),
  ]);
  const statuses:Record<string,string>={watched:"Просмотрено",watching:"Смотрю",later:"Позже",dropped:"Брошено"};
  return <><div className="clio-rating"><span><I18nText text="Рейтинг Clio"/></span><strong>{aggregate.count?Number(aggregate.average).toFixed(1):"—"}</strong>{aggregate.count>0&&<span>· {aggregate.count} <I18nText text="оценок"/></span>}</div>
    <div className="media-toolbar">
      <Sheet label="В библиотеку" title="Моя библиотека" icon="bookmark" value={entry?.status?statuses[entry.status]:entry?"Сохранено":"В библиотеку"} className={entry?"action-selected":""}><ActionForm op="library-save" fields={{mediaId}} label="Сохранить статус" closeOnSuccess><label className="field"><I18nText text="Статус"/><select name="status" defaultValue={entry?.status??""}><option value=""><I18nText text="Без статуса"/></option><option value="watched"><I18nText text="Просмотрено"/></option><option value="watching"><I18nText text="Смотрю"/></option><option value="later"><I18nText text="Посмотреть позже"/></option><option value="dropped"><I18nText text="Брошено"/></option></select></label><label className="check-field"><input type="checkbox" name="favorite" defaultChecked={entry?.favorite}/><I18nText text="Избранное"/></label></ActionForm></Sheet>
      <Sheet label="Моя оценка" icon="star" value={rating?String(rating.score/2)+" / 10":"Оценить"} className={rating?"action-selected":""}><ActionForm op="rating-save" fields={{mediaId}} label="Сохранить оценку" closeOnSuccess><label className="field"><I18nText text="Моя оценка"/><select name="score" defaultValue={rating?.score??""}><option value=""><I18nText text="Без оценки"/></option>{Array.from({length:19},(_,i)=>i+2).map(score=><option value={score} key={score}>{score/2} / 10</option>)}</select></label><p className="muted"><I18nText text="Одна текущая оценка. Изменения сохраняются в истории."/></p></ActionForm></Sheet>
      <Sheet label="Рецензия" title="Моя рецензия" hash="review-edit" icon="review" className={review?"action-selected":""}><div id="review-edit">{review?.hidden&&<p className="notice"><I18nText text="Рецензия скрыта модератором. Изменение текста не снимает ограничение."/></p>}<ActionForm op="review-save" fields={{mediaId}} label="Сохранить рецензию" closeOnSuccess><label className="field"><I18nText text="Текст"/><textarea name="body" minLength={1} maxLength={10000} required defaultValue={review?.body}/></label><VisibilitySelect initial={review?.visibility}/><label className="check-field"><input name="spoiler" type="checkbox" defaultChecked={review?.spoiler}/><I18nText text="Есть спойлеры"/></label></ActionForm>{review&&<Link className="text-link" href={"/reviews/"+review.id}><I18nText text="Открыть рецензию"/></Link>}</div></Sheet>
      <Sheet label="Ещё" icon="more">
        <details className="action-disclosure"><summary><I18nText text="Записать просмотр"/></summary><ActionForm op="watch-add" fields={{mediaId}} label="Записать просмотр" reset closeOnSuccess><label className="field"><I18nText text="Дата"/><input type="date" name="watchedOn" required defaultValue={new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Moscow"})}/></label><label className="field"><I18nText text="Заметка"/><textarea name="note" maxLength={1000}/></label></ActionForm></details>
        <details className="action-disclosure"><summary><I18nText text="Добавить в коллекцию"/></summary>{lists.length?<ActionForm op="collection-add" fields={{mediaId}} label="Добавить в коллекцию" closeOnSuccess><label className="field"><I18nText text="Коллекция"/><select name="collectionId">{lists.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label></ActionForm>:<Link className="menu-link" href="/collections"><I18nText text="Создать коллекцию"/></Link>}</details>
        {aggregate.count>0&&<details className="action-disclosure"><summary><I18nText text="Рейтинг Clio"/></summary><p><I18nText text="· Взвешенный рейтинг:"/> {Number(aggregate.weighted).toFixed(1)}</p></details>}
        {role?.role==="admin"&&<details className="action-disclosure"><summary><I18nText text="Исправить карточку (модератор)"/></summary><ActionForm op="catalog-edit" fields={{mediaId}} label="Сохранить" closeOnSuccess><label className="field"><I18nText text="Название Clio (пусто — TMDB)"/><input name="titleOverride" defaultValue={catalogEntry?.titleOverride??""} maxLength={200}/></label><label className="field"><I18nText text="Классификация"/><select name="animationOverride" defaultValue={catalogEntry?.animationOverride??""}><option value=""><I18nText text="По данным TMDB"/></option><option value="none"><I18nText text="Без категории анимации"/></option><option value="animation"><I18nText text="Анимация"/></option><option value="anime"><I18nText text="Аниме"/></option></select></label></ActionForm></details>}
        {entry&&<ActionForm op="library-delete" fields={{mediaId}} label="Убрать из библиотеки" danger closeOnSuccess/>}
      </Sheet>
    </div>
    {reviewRows.length>0&&<section className="community-reviews"><h2 className="section-title"><I18nText text="Рецензии"/></h2>{reviewRows.map(row=><ReviewCard key={row.id} row={row} viewer={uid}/>)}</section>}
  </>;
}
