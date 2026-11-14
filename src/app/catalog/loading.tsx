
import { I18nText } from "@/components/i18n";
export default function Loading() {
  return <div className="catalog-page" role="status" aria-live="polite"><h1><I18nText text={"Загружаем каталог…"}/></h1><p className="muted"><I18nText text={"Ищем следующую историю."}/></p><div className="media-grid" aria-hidden>{Array.from({ length: 6 }, (_, i) => <div key={i} className="poster skeleton" />)}</div></div>;
}
