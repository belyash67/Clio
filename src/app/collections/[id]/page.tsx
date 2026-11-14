import {UserName} from "@/components/user-name";

import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { memberContext } from "@/server/session";
import { profileVisible } from "@/modules/social/policies";
import { uuid } from "@/modules/social/common";
import { mediaColumns, pageNumber, type CollectionRow, type MediaRow } from "@/modules/social/queries";
import { MediaGrid, PageNav } from "@/components/social-ui";
import { ActionForm } from "@/components/action-form";

export default async function Collection({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}) {
  const ctx=await memberContext();const cid=(await params).id;if(!uuid.safeParse(cid).success)notFound();
  const [row]=(await ctx.db.execute<CollectionRow>(sql`select c.*,(select count(*)::int from collection_media where collection_id=c.id) as count,c.user_id as "userId",u.username,u.personal_badge as badge from collections c join users u on u.id=c.user_id left join user_settings s on s.user_id=u.id where c.id=${cid} and ${profileVisible(ctx.uid)} and (c.user_id=${ctx.uid} or c.public)`)).rows;if(!row)notFound();
  const page=pageNumber((await searchParams).page);const items=(await ctx.db.execute<MediaRow & {position:number}>(sql`select ${mediaColumns},cm.position from collection_media cm join media m on m.id=cm.media_id where cm.collection_id=${cid} order by cm.position limit 24 offset ${(page-1)*24}`)).rows;
  return <div className="catalog-page"><Link href="/collections" className="text-link"><I18nText text={"← Коллекции"}/></Link><h1>{row.title}</h1><p className="user-text">{row.description}</p><p className="muted"><I18nText text={"Автор:"}/>{" "}<UserName username={row.username} badge={row.badge}/> · {row.public?<I18nText text={"Открытая"}/>:<I18nText text={"Личная"}/>}</p>
    {row.userId===ctx.uid&&<details className="social-card"><summary><I18nText text={"Настройки коллекции"}/></summary><ActionForm op="collection-save" fields={{collectionId:cid}} label="Сохранить"><label className="field"><I18nText text={"Название"}/><input name="title" required maxLength={100} defaultValue={row.title}/></label><label className="field"><I18nText text={"Описание"}/><textarea name="description" maxLength={2000} defaultValue={row.description}/></label><label className="check-field"><input name="public" type="checkbox" defaultChecked={row.public}/><I18nText text={"Открытая"}/></label></ActionForm><ActionForm op="collection-delete" fields={{collectionId:cid}} label="Удалить коллекцию" danger/></details>}
    <MediaGrid rows={items}/>{row.userId===ctx.uid&&items.length>0&&<details className="info-disclosure"><summary><I18nText text="Изменить порядок"/></summary>{items.map((item,index)=><div className="social-card" key={item.mediaId}><strong>{item.title}</strong><div className="inline-actions">{(page>1||index>0)&&<ActionForm op="collection-move" fields={{collectionId:cid,mediaId:item.mediaId,direction:"up"}} label="↑ Выше"/>}{(page-1)*24+index<row.count-1&&<ActionForm op="collection-move" fields={{collectionId:cid,mediaId:item.mediaId,direction:"down"}} label="↓ Ниже"/>}<ActionForm op="collection-remove" fields={{collectionId:cid,mediaId:item.mediaId}} label="Убрать"/></div></div>)}</details>}<PageNav page={page} hasNext={items.length===24} base={`/collections/${cid}`}/>{row.userId===ctx.uid&&items.length===0&&<Link className="button secondary" href="/catalog"><I18nText text="Найти фильм"/></Link>}
  </div>;
}
