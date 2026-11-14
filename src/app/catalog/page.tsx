import {Sheet} from "@/components/mobile-ui";
import {SectionTabs} from "@/components/section-tabs";

import { LocalizedInput, LocalizedNav } from "@/components/i18n";

import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { Search } from "lucide-react";
import { catalogQuerySchema, catalogErrorMessage, mediaTitle, mediaYear, type TmdbItem } from "@/modules/catalog/contracts";
import { hasTmdbToken, searchCatalog, catalogLookups, searchPeople } from "@/server/integrations/tmdb";
import { Poster } from "@/modules/catalog/poster";

export const dynamic = "force-dynamic";
export const metadata = { title: "Каталог" };
export default async function Catalog({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const parsed = catalogQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});
  let genres:{id:number;name:string}[]=[];let people:{id:number;name:string;known_for_department?:string}[]=[];
  let items: TmdbItem[] = [];
  let pages = 0;
  let warning = "";
  let error = parsed.success ? "" : "Проверь параметры поиска: название до 120 символов, страница от 1 до 500.";
  if (!error && hasTmdbToken()) {
    try {
      try{genres=(await catalogLookups(query.type)).data.genres;}catch{}
      const result = query.mode==="person"&&query.q ? await searchPeople(query.q,query.page) : await searchCatalog(query.type, query.mode==="person"?"":query.q, query.page,query);
      if(query.mode==="person"&&query.q)people=result.data.results as typeof people;
      else items = (result.data.results as TmdbItem[]).filter((item) => !item.adult);
      pages = Math.min(result.data.total_pages, 500);
      if (result.stale) warning = `Источник временно недоступен. Показываем данные от ${result.fetchedAt.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}.`;
    } catch (cause) { error = catalogErrorMessage(cause); }
  } else if (!error) error = "Каталог ещё подключается. Здесь появятся фильмы и сериалы после настройки источника данных.";
  const pageLink = (page: number) => `/catalog?${new URLSearchParams({ ...query, page: String(page) })}`;
  const activeFilters=[query.year,query.genre,query.country,query.minRating,query.animation,query.sort!=="popularity.desc"?"sort":""].filter(Boolean).length;
  const category=(type:string,mode="title")=>"/catalog?"+new URLSearchParams({q:query.q,type,mode});
  return <div className="catalog-page"><div className="page-heading"><h1><I18nText text="Каталог"/></h1><Sheet label="Фильтры" icon="filters" iconOnly badge={activeFilters}>
      <form action="/catalog" className="filter-form"><input type="hidden" name="q" value={query.q}/>
        <input name="mode" value={query.mode} type="hidden"/>
        {query.mode==="person"?<label className="field"><I18nText text="Тип"/><select name="type" defaultValue={query.type}><option value="movie"><I18nText text="Фильмы"/></option><option value="tv"><I18nText text="Сериалы"/></option></select></label>:<><input name="type" value={query.type} type="hidden"/>
          <div className="filter-grid"><label className="field"><I18nText text="Год"/><input name="year" type="number" min={1888} max={2100} defaultValue={query.year}/></label><label className="field"><I18nText text="Рейтинг TMDB от"/><input name="minRating" type="number" min={0} max={10} step={0.5} defaultValue={query.minRating} disabled={!!query.q}/></label></div>
          <label className="field"><I18nText text="Жанр"/><select name="genre" defaultValue={query.genre} disabled={!!query.q}><option value=""><I18nText text="Все жанры"/></option>{genres.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <details className="advanced-filters"><summary><I18nText text="Дополнительно"/></summary><div className="filter-form">
            <label className="field"><I18nText text="Страна производства"/><input name="country" pattern="[A-Z]{2}" maxLength={2} placeholder="RU, US, JP…" defaultValue={query.country} disabled={!!query.q}/></label>
            <label className="field"><I18nText text="Отбор"/><select name="animation" defaultValue={query.animation} disabled={!!query.q}><option value=""><I18nText text="Всё"/></option><option value="animation"><I18nText text="Анимация"/></option><option value="anime"><I18nText text="Аниме по тегу TMDB"/></option></select></label>
            <label className="field"><I18nText text="Сортировка"/><select name="sort" defaultValue={query.sort} disabled={!!query.q}><option value="popularity.desc"><I18nText text="Популярность"/></option><option value="vote_average.desc"><I18nText text="Рейтинг TMDB"/></option><option value="primary_release_date.desc"><I18nText text="Дата выхода"/></option><option value="title.asc"><I18nText text="Название"/></option></select></label>
          </div></details>
        </>}
        {query.q&&<p className="muted"><I18nText text="Поиск по тексту использует релевантность TMDB. Для подбора по жанру, стране, рейтингу и анимации очисти название. Год применяется к поиску названий."/></p>}
        <button className="button primary"><I18nText text="Показать"/></button><Link className="text-link" href="/catalog"><I18nText text="Сбросить фильтры"/></Link>
      </form>
    </Sheet></div>
    <form className="search-bar" action="/catalog" method="get"><label><span className="sr-only"><I18nText text="Поиск"/></span><LocalizedInput type="search" name="q" maxLength={120} defaultValue={query.q} placeholder={query.mode==="person"?"Актёр или режиссёр":"Название фильма или сериала"}/></label><input type="hidden" name="type" value={query.type}/><input type="hidden" name="mode" value={query.mode}/><button className="icon-button" aria-label="Найти"><Search size={22} aria-hidden/></button></form>
    <SectionTabs active={query.mode==="person"?"person":query.type} items={[{id:"movie",label:"Фильмы",href:category("movie")},{id:"tv",label:"Сериалы",href:category("tv")},{id:"person",label:"Люди",href:category(query.type,"person")}]}/>
    {error?<div className="empty-state" role="status"><I18nText text={error}/></div>:<>
      {warning&&<p className="notice" role="status">{warning}</p>}
      {!query.q&&<h2 className="section-title"><I18nText text={activeFilters?"Подборка":"Сейчас популярно"}/></h2>}
      {people.length?<div className="people-list">{people.map(person=><Link className="person-row" href={"/people/"+person.id+"?type="+query.type} key={person.id}><span className="person-avatar" aria-hidden>{person.name.slice(0,1)}</span><div><strong>{person.name}</strong><span className="muted">{person.known_for_department}</span></div></Link>)}</div>:items.length?<div className="media-grid">{items.map(item=><Link className="media-card" href={"/catalog/"+query.type+"/"+item.id} key={item.id}><Poster path={item.poster_path} title={mediaTitle(item)}/><h3>{mediaTitle(item)}</h3><p>{mediaYear(item)}{item.vote_count>0&&<span>★ {item.vote_average.toFixed(1)}</span>}</p></Link>)}</div>:<div className="empty-state"><p><I18nText text="Ничего не найдено. Попробуй другое или оригинальное название."/></p></div>}
      {pages>1&&<LocalizedNav className="pagination" aria-label="Страницы результатов">{query.page>1&&<Link className="button secondary" href={pageLink(query.page-1)}><I18nText text="← Назад"/></Link>}<span>{query.page} / {pages}</span>{query.page<pages&&<Link className="button secondary" href={pageLink(query.page+1)}><I18nText text="Далее →"/></Link>}</LocalizedNav>}
    </>}
    <p className="catalog-source">TMDB · <Link href="/credits"><I18nText text="Об источнике"/></Link></p>
  </div>;
}
