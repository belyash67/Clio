import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import {requireSession} from "@/server/session";
import {libraryRows} from "@/modules/social/queries";
import {searchCatalog,hasTmdbToken} from "@/server/integrations/tmdb";
import {mediaTitle,type TmdbItem} from "@/modules/catalog/contracts";
import {Poster} from "@/modules/catalog/poster";
import {I18nText} from "@/components/i18n";

export async function HomeDashboard(){
  const session=await requireSession();const uid=session.user.id;
  const watching=await libraryRows(uid,uid,1,"","watching");
  let discoveries:TmdbItem[]=[];
  if(hasTmdbToken())try{discoveries=(await searchCatalog("movie","",1)).data.results.filter(item=>!item.adult).slice(0,9);}catch{}
  const first=discoveries[0];
  return <div className="catalog-page home-feed"><div className="page-heading"><h1><I18nText text="Для тебя"/></h1></div>
    {first?<Link className="spotlight" href={"/catalog/movie/"+first.id}><Poster path={first.poster_path} title={mediaTitle(first)} eager/><div className="spotlight-caption"><span><I18nText text="Открой сегодня"/></span><h2>{mediaTitle(first)}</h2><span className="spotlight-open"><I18nText text="Подробнее"/><ArrowUpRight size={21} aria-hidden/></span></div></Link>:<div className="empty-state"><p><I18nText text="Найди историю для сегодняшнего вечера."/></p><Link className="button primary" href="/catalog"><I18nText text="Найти фильм"/></Link></div>}
    {watching.length>0&&<section className="home-shelf"><div className="shelf-heading"><h2><I18nText text="Продолжаю смотреть"/></h2><Link className="text-link" href="/library?status=watching"><I18nText text="Все"/></Link></div><div className="poster-rail">{watching.slice(0,8).map(item=><Link className="media-card" href={"/catalog/"+item.type+"/"+item.tmdbId} key={item.mediaId}><Poster path={item.posterPath} title={item.title}/><h3>{item.title}</h3></Link>)}</div></section>}
    {discoveries.length>1&&<section className="home-shelf"><div className="shelf-heading"><h2><I18nText text="Ещё открытия"/></h2><Link className="text-link" href="/catalog"><I18nText text="Каталог"/></Link></div><div className="poster-rail">{discoveries.slice(1).map(item=><Link className="media-card" href={"/catalog/movie/"+item.id} key={item.id}><Poster path={item.poster_path} title={mediaTitle(item)}/><h3>{mediaTitle(item)}</h3></Link>)}</div></section>}
    <p className="catalog-source">TMDB · <Link href="/credits"><I18nText text="Об источнике"/></Link></p>
  </div>;
}
