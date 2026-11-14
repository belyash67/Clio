
import { I18nText } from "@/components/i18n";
export const metadata = { title: "Источники данных" };
export default function Credits() {
  return <div className="catalog-page"><span className="eyebrow"><I18nText text={"О ПРОЕКТЕ"}/></span><h1><I18nText text={"Источники данных"}/></h1><p><I18nText text={"Clio использует метаданные и изображения"}/>{" "}<a className="text-link" href="https://www.themoviedb.org" target="_blank" rel="noreferrer">The Movie Database (TMDB)</a>.</p><blockquote className="notice" lang="en">This product uses the TMDB API but is not endorsed or certified by TMDB.</blockquote><p className="muted"><I18nText text={"Оценки TMDB принадлежат сообществу TMDB. Оценки Clio показываются отдельно на странице произведения."}/></p></div>;
}
