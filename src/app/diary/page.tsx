
import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { memberContext } from "@/server/session";
import { ActionForm } from "@/components/action-form";
import { PageNav } from "@/components/social-ui";
import { pageNumber, type MediaRow, mediaColumns } from "@/modules/social/queries";

export const metadata={title:"Кинодневник"};
export default async function Diary({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const ctx=await memberContext();const page=pageNumber((await searchParams).page);
  const rows=(await ctx.db.execute<MediaRow & {id:string;watchedOn:string;note:string}>(sql`select w.id,to_char(w.watched_on,'YYYY-MM-DD') as "watchedOn",w.note,${mediaColumns} from watch_history w join media m on m.id=w.media_id where w.user_id=${ctx.uid} order by w.watched_on desc,w.created_at desc,w.id limit 24 offset ${(page-1)*24}`)).rows;
  return <div className="catalog-page"><Link href="/library" className="text-link"><I18nText text={"← Библиотека"}/></Link><h1><I18nText text={"Кинодневник"}/></h1><p className="muted"><I18nText text={"Каждый просмотр — отдельное событие. Повторные просмотры сохраняются."}/></p>{rows.length?rows.map(row=><article className="social-card" key={row.id}><span className="eyebrow">{row.watchedOn}</span><h2><Link href={`/catalog/${row.type}/${row.tmdbId}`}>{row.title}</Link></h2><p className="user-text">{row.note}</p><details><summary><I18nText text="Редактировать запись"/></summary><ActionForm op="watch-edit" fields={{id:row.id}} label="Сохранить"><input name="watchedOn" type="date" required defaultValue={row.watchedOn}/><textarea name="note" maxLength={1000} defaultValue={row.note}/></ActionForm></details><ActionForm op="watch-delete" fields={{id:row.id}} label="Удалить запись" danger/></article>):<p className="notice"><I18nText text={"Запиши первый просмотр на странице фильма или сериала."}/></p>}<PageNav page={page} hasNext={rows.length===24} base="/diary"/></div>;
}
