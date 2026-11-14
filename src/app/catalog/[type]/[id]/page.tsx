
import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogError, catalogErrorMessage, mediaTypeSchema, mediaTitle, mediaYear } from "@/modules/catalog/contracts";
import { getMediaDetails } from "@/server/integrations/tmdb";
import { Poster } from "@/modules/catalog/poster";
import { MediaActions } from "@/modules/library/media-actions";

export const dynamic = "force-dynamic";
export default async function MediaPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const route = await params;
  const type = mediaTypeSchema.safeParse(route.type);
  if (!type.success || !/^[1-9]\d{0,8}$/.test(route.id)) notFound();
  let result;
  try { result = await getMediaDetails(type.data, Number(route.id)); }
  catch (error) {
    if (error instanceof CatalogError && error.reason === "not-found") notFound();
    return <div className="catalog-page"><Link className="text-link" href="/catalog"><I18nText text={"← К каталогу"}/></Link><h1><I18nText text={"Не удалось открыть карточку"}/></h1><p className="notice">{catalogErrorMessage(error)}</p><Link className="button secondary" href={`/catalog/${type.data}/${route.id}`}><I18nText text={"Повторить загрузку"}/></Link></div>;
  }
  const item = result.data;
  const title = result.titleOverride || mediaTitle(item);
  const keywords=item.keywords?.keywords??item.keywords?.results??[];
  const kind=result.animationOverride??(keywords.some(keyword=>keyword.name.toLowerCase()==="anime")?"anime":item.genres.some(genre=>genre.id===16)?"animation":"none");
  const original = item.original_title || item.original_name;
  const creators = type.data === "movie" ? item.credits?.crew.filter((person) => person.job === "Director") ?? [] : item.created_by;
  const runtime = type.data === "movie" ? item.runtime : item.episode_run_time[0];
  return <article className="catalog-page media-page"><Link className="back-link" href={"/catalog?type="+type.data}><I18nText text="← К каталогу"/></Link>
    {result.stale&&<p className="notice"><I18nText text="Показываем ранее загруженные сведения от"/> {result.fetchedAt.toLocaleDateString("ru-RU",{timeZone:"Europe/Moscow"})}</p>}
    <div className="media-detail"><Poster path={item.poster_path} title={title} eager/><div className="media-intro"><span className="media-kicker"><I18nText text={type.data==="movie"?"ФИЛЬМ":"СЕРИАЛ"}/> · {mediaYear(item)}</span><h1>{title}</h1>{original!==title&&<p className="muted original-title">{original}</p>}<div className="genre-tags">{item.genres.slice(0,2).map(genre=><span key={genre.id}>{genre.name}</span>)}{kind!=="none"&&<span><I18nText text={kind==="anime"?"Аниме":"Анимация"}/></span>}</div><p className="media-rating">TMDB {item.vote_count?<strong>{item.vote_average.toFixed(1)}</strong>:"—"}</p></div></div>
    <MediaActions mediaId={result.mediaId}/>
    <details className="info-disclosure"><summary><I18nText text="О фильме"/></summary><p>{item.overview||<I18nText text="Описание на русском языке пока отсутствует."/>}</p><dl className="media-facts"><dt><I18nText text="Страна"/></dt><dd>{item.production_countries.map(country=>country.name).join(", ")||"—"}</dd><dt><I18nText text={type.data==="movie"?"Режиссёр":"Создатели"}/></dt><dd>{creators.map(person=>person.name).join(", ")||"—"}</dd><dt><I18nText text="Продолжительность"/></dt><dd>{runtime?runtime+" мин":"—"}</dd>{type.data==="tv"&&<><dt><I18nText text="Сезоны / эпизоды"/></dt><dd>{item.number_of_seasons??"—"} / {item.number_of_episodes??"—"}</dd></>}</dl></details>
    {!!item.credits?.cast.length&&<details className="info-disclosure"><summary><I18nText text="В ролях"/></summary><div className="cast-grid">{item.credits.cast.slice(0,12).map((person,index)=><Link href={"/people/"+person.id+"?type="+type.data} key={person.id+":"+index}><strong>{person.name}</strong>{person.character&&<span>{person.character}</span>}</Link>)}</div></details>}
    <p className="catalog-source">TMDB · <Link href="/credits"><I18nText text="Атрибуция"/></Link></p>
  </article>;
}
