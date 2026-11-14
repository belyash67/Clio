
import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { personCredits } from "@/server/integrations/tmdb";
import { catalogErrorMessage, mediaTitle, mediaYear } from "@/modules/catalog/contracts";
import { Poster } from "@/modules/catalog/poster";
import { pageNumber } from "@/modules/social/queries";
import { PageNav } from "@/components/social-ui";

export const dynamic="force-dynamic";
export default async function Person({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{type?:string;page?:string}>}) {
  const id=(await params).id;if(!/^[1-9]\d{0,8}$/.test(id))notFound();const p=await searchParams;const type=p.type==="tv"?"tv":"movie";const page=pageNumber(p.page);
  let items;try{items=await personCredits(Number(id),type);}catch(error){return <div className="catalog-page"><h1><I18nText text={"Фильмография"}/></h1><p className="notice">{catalogErrorMessage(error)}</p></div>;}
  const rows=items.slice((page-1)*24,page*24);
  return <div className="catalog-page"><Link href="/catalog?mode=person" className="text-link"><I18nText text={"← Поиск людей"}/></Link><h1><I18nText text={"Фильмография"}/></h1><p className="muted"><I18nText text={"Актёрские работы и режиссёрские/авторские кредиты TMDB, от новых к старым."}/></p><div className="inline-actions"><Link href={`/people/${id}?type=movie`} className="button secondary"><I18nText text={"Фильмы"}/></Link><Link href={`/people/${id}?type=tv`} className="button secondary"><I18nText text={"Сериалы"}/></Link></div><div className="media-grid">{rows.map(item=><Link className="media-card" key={item.id} href={`/catalog/${type}/${item.id}`}><Poster path={item.poster_path} title={mediaTitle(item)}/><h3>{mediaTitle(item)}</h3><p>{mediaYear(item)}</p></Link>)}</div>{!rows.length&&<p className="notice"><I18nText text={"Работ этого типа не найдено."}/></p>}<PageNav page={page} hasNext={page*24<items.length} base={`/people/${id}`} query={{type}}/></div>;
}
