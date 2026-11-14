import {UserName} from "@/components/user-name";
import {Heart,MessageCircle} from "lucide-react";
import {Sheet} from "./mobile-ui";

import { LocalizedNav } from "@/components/i18n";

import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { Poster } from "@/modules/catalog/poster";
import { type MediaRow, type ReviewRow, type CollectionRow } from "@/modules/social/queries";
import { ActionForm } from "./action-form";

export const statusLabels: Record<string,string> = { watched: "Просмотрено", watching: "Смотрю", later: "Посмотреть позже", dropped: "Брошено" };
export function VisibilitySelect({ initial = "private" }: { initial?: string }) { return <label className="field"><I18nText text={"Видимость"}/><select name="visibility" defaultValue={initial}><option value="private"><I18nText text={"Только я"}/></option><option value="friends"><I18nText text={"Друзья"}/></option><option value="public"><I18nText text={"Все"}/></option></select></label>; }
export function MediaGrid({ rows }: { rows: MediaRow[] }) {
  return rows.length ? <div className="media-grid">{rows.map((row) => <Link href={`/catalog/${row.type}/${row.tmdbId}`} className="media-card" key={row.mediaId}><Poster title={row.title} path={row.posterPath}/><h3>{row.title}</h3><p>{row.status && <I18nText text={statusLabels[row.status]}/>}{row.favorite && " ♥"}{row.score != null && <span><I18nText text={"Моя оценка:"}/>{" "}{row.score / 2}</span>}</p></Link>)}</div> : <p className="notice"><I18nText text={"Пока пусто"}/></p>;
}
export function PageNav({ page, hasNext, base, query = {} }: { page: number; hasNext: boolean; base: string; query?: Record<string,string> }) {
  if(page===1&&!hasNext)return null;
  const href = (p: number) => `${base}?${new URLSearchParams({ ...query, page: String(p) })}`;
  return <LocalizedNav className="pagination" aria-label="Пагинация">{page > 1 && <Link className="button secondary" href={href(page-1)}><I18nText text={"← Назад"}/></Link>}<span><I18nText text={"Страница"}/>{" "}{page}</span>{hasNext && <Link className="button secondary" href={href(page+1)}><I18nText text={"Далее →"}/></Link>}</LocalizedNav>;
}
export function ReviewCard({ row, viewer,full=false }: { row: ReviewRow; viewer: string;full?:boolean }) {
  return <article className={`social-card ${full?"review-full":""}`}><div className="card-heading"><UserName username={row.username} badge={row.badge}/><span className="muted">{new Date(row.createdAt).toLocaleDateString("ru-RU")}</span></div><h3><Link href={`/catalog/${row.type}/${row.tmdbId}`}>{row.title}</Link></h3>{row.spoiler ? <details><summary><I18nText text={"Рецензия со спойлерами — раскрыть"}/></summary><p className="user-text">{row.body}</p></details> : <p className="user-text">{row.body}</p>}{!full&&!row.spoiler&&row.body.length>240&&<Link className="text-link" href={`/reviews/${row.id}`}><I18nText text="Читать полностью"/></Link>}
    <div className="inline-actions review-actions"><ActionForm op="review-like" fields={{ reviewId: row.id, liked: String(row.liked) }} label={`${row.liked ? "Убрать лайк" : "Нравится"} · ${row.likes}`} buttonContent={<><Heart size={19} fill={row.liked?"currentColor":"none"} aria-hidden/><span>{row.likes}</span></>}/><Link className="compact-action" href={`/reviews/${row.id}`}><MessageCircle size={19} aria-hidden/><I18nText text="Комментарии"/></Link>{row.userId===viewer&&<Sheet label="Действия с рецензией" iconOnly><a className="menu-link" href={`/catalog/${row.type}/${row.tmdbId}#review-edit`}><I18nText text="Редактировать"/></a><ActionForm op="review-delete" fields={{id:row.id}} label="Удалить рецензию" danger/></Sheet>}</div>
  </article>;
}
export function CollectionCards({ rows }: { rows: CollectionRow[] }) {
  return rows.length ? <div className="collection-grid">{rows.map((row) => <Link href={`/collections/${row.id}`} className="social-card" key={row.id}><span className="eyebrow"><I18nText text={row.public ? "ОТКРЫТАЯ" : "ЛИЧНАЯ"}/>{" "}<I18nText text={"КОЛЛЕКЦИЯ"}/></span><h2>{row.title}</h2><p>{row.description}</p><p className="muted">{row.count}{" "}<I18nText text={"произведений"}/></p></Link>)}</div> : <p className="notice"><I18nText text={"Коллекций пока нет."}/></p>;
}
