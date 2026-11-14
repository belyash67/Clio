import Link from "next/link";
import {sql} from "drizzle-orm";
import {memberContext} from "@/server/session";
import {mediaColumns,pageNumber,type MediaRow} from "@/modules/social/queries";
import {PageNav,MediaGrid} from "@/components/social-ui";
import {I18nText} from "@/components/i18n";

export const metadata={title:"Мои оценки"};
export default async function Ratings({searchParams}:{searchParams:Promise<{page?:string}>}){
  const ctx=await memberContext();const page=pageNumber((await searchParams).page);
  const [current,history]=await Promise.all([
    ctx.db.execute<MediaRow>(sql`select ${mediaColumns},r.score from ratings r join media m on m.id=r.media_id where r.user_id=${ctx.uid} order by r.updated_at desc,r.media_id limit 24 offset ${(page-1)*24}`),
    ctx.db.execute<MediaRow & {id:string;oldScore:number|null;newScore:number|null;createdAt:Date}>(sql`select ${mediaColumns},e.id,e.old_score as "oldScore",e.new_score as "newScore",e.created_at as "createdAt" from rating_events e join media m on m.id=e.media_id where e.user_id=${ctx.uid} order by e.created_at desc,e.id limit 24 offset ${(page-1)*24}`),
  ]);
  return <div className="catalog-page"><Link className="text-link" href="/library"><I18nText text="← Библиотека"/></Link><h1><I18nText text="Мои оценки"/></h1><MediaGrid rows={current.rows}/><section className="social-section"><h2><I18nText text="История оценок"/></h2>{history.rows.map(row=><article className="social-card" key={row.id}><Link href={`/catalog/${row.type}/${row.tmdbId}`}>{row.title}</Link><p>{row.oldScore==null?"—":row.oldScore/2} → {row.newScore==null?"—":row.newScore/2}</p><span className="muted">{new Date(row.createdAt).toLocaleString("ru-RU")}</span></article>)}{!history.rows.length&&<p className="muted"><I18nText text="Изменений оценок пока нет."/></p>}</section><PageNav base="/ratings" page={page} hasNext={current.rows.length===24||history.rows.length===24}/></div>;
}
