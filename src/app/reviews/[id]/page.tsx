import {UserName} from "@/components/user-name";

import { LocalizedInput } from "@/components/i18n";

import { I18nText } from "@/components/i18n";
import { sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { memberContext } from "@/server/session";
import { visibleReviews, pageNumber } from "@/modules/social/queries";
import { uuid } from "@/modules/social/common";
import { ReviewCard, PageNav } from "@/components/social-ui";
import { ActionForm } from "@/components/action-form";

export default async function Review({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}) {
  const ctx=await memberContext();const rid=(await params).id;if(!uuid.safeParse(rid).success)notFound();
  const [row]=await visibleReviews(ctx.uid,{id:rid});if(!row)notFound();const page=pageNumber((await searchParams).page);
  const comments=(await ctx.db.execute<{id:string;userId:string;username:string;badge?:boolean;body:string;parentId:string|null}>(sql`select c.id,c.user_id as "userId",u.username,u.personal_badge as badge,c.body,c.parent_id as "parentId" from comments c join users u on u.id=c.user_id where c.review_id=${rid} and not c.hidden and u.blocked_at is null order by c.created_at,c.id limit 24 offset ${(page-1)*24}`)).rows;
  return <div className="catalog-page"><h1><I18nText text={"Рецензия"}/></h1><ReviewCard row={row} viewer={ctx.uid} full/><h2><I18nText text={"Комментарии"}/></h2>{comments.map(comment=><article className="social-card" key={comment.id}><UserName username={comment.username} badge={comment.badge}/>{comment.parentId&&<span className="muted">{" "}<I18nText text={"· Ответ на комментарий"}/></span>}<p className="user-text">{comment.body}</p>{comment.userId===ctx.uid?<><details><summary><I18nText text="Редактировать комментарий"/></summary><ActionForm op="comment-edit" fields={{id:comment.id}} label="Сохранить"><textarea name="body" required maxLength={2000} defaultValue={comment.body}/></ActionForm></details><ActionForm op="comment-delete" fields={{id:comment.id}} label="Удалить" danger/></>:<details><summary><I18nText text={"Пожаловаться"}/></summary><ActionForm op="report-create" fields={{commentId:comment.id}} label="Отправить жалобу"><LocalizedInput name="reason" required maxLength={1000} placeholder="Причина"/></ActionForm></details>}<details><summary><I18nText text={"Ответить"}/></summary><ActionForm op="comment-add" fields={{reviewId:rid,parentId:comment.id}} label="Ответить" reset><textarea name="body" required maxLength={2000}/></ActionForm></details></article>)}{!comments.length&&<p className="muted"><I18nText text={"Пока без комментариев."}/></p>}<PageNav page={page} hasNext={comments.length===24} base={`/reviews/${rid}`}/><ActionForm op="comment-add" fields={{reviewId:rid}} label="Добавить комментарий" reset><label className="field"><I18nText text={"Комментарий"}/><textarea name="body" required maxLength={2000}/></label></ActionForm>{row.userId!==ctx.uid&&<details className="social-card"><summary><I18nText text={"Пожаловаться на рецензию"}/></summary><ActionForm op="report-create" fields={{reviewId:rid}} label="Отправить"><textarea name="reason" required maxLength={1000}/></ActionForm></details>}</div>;
}
