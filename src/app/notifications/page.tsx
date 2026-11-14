import {UserName} from "@/components/user-name";

import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { memberContext } from "@/server/session";
import { canReadReview } from "@/modules/social/common";
import { pageNumber } from "@/modules/social/queries";
import { PageNav } from "@/components/social-ui";
import { ActionForm } from "@/components/action-form";

export const metadata={title:"Уведомления"};
export default async function Notifications({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const ctx=await memberContext();const page=pageNumber((await searchParams).page);
  const rows=(await ctx.db.execute<{id:string;kind:string;username:string;badge?:boolean;reviewId:string|null;readAt:Date|null;createdAt:Date}>(sql`select n.id,n.kind,u.username,u.personal_badge as badge,n.review_id as "reviewId",n.read_at as "readAt",n.created_at as "createdAt" from notifications n join users u on u.id=n.actor_id where n.user_id=${ctx.uid} and u.blocked_at is null order by n.created_at desc,n.id limit 24 offset ${(page-1)*24}`)).rows;
  const labels:Record<string,string>={"friend-request":"отправил(а) запрос в друзья","friend-accepted":"принял(а) запрос в друзья",like:"оценил(а) рецензию",comment:"прокомментировал(а) рецензию",reply:"ответил(а) на комментарий"};
  const visible=await Promise.all(rows.map(async row=>({ ...row, allowed:row.reviewId?!!await canReadReview(ctx,row.reviewId):true })));
  return <div className="catalog-page"><h1><I18nText text={"Уведомления"}/></h1><ActionForm op="notifications-read" label="Отметить все прочитанными"/>{visible.filter(row=>row.allowed).map(row=><article className={`social-card ${row.readAt?"":"unread"}`} key={row.id}><p><UserName username={row.username} badge={row.badge}/> {labels[row.kind]??<I18nText text={"обновил(а) активность"}/>}.</p><Link className="text-link" href={row.reviewId?`/reviews/${row.reviewId}`:"/community"}><I18nText text={"Открыть"}/></Link><p className="muted">{new Date(row.createdAt).toLocaleString("ru-RU")}</p></article>)}{!visible.some(row=>row.allowed)&&<p className="notice"><I18nText text={"Новых доступных уведомлений нет."}/></p>}<PageNav base="/notifications" page={page} hasNext={rows.length===24}/></div>;
}
