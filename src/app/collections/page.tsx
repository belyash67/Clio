
import { I18nText } from "@/components/i18n";
import { memberContext } from "@/server/session";
import { collectionRows, pageNumber } from "@/modules/social/queries";
import { ActionForm } from "@/components/action-form";
import { CollectionCards, PageNav } from "@/components/social-ui";

export const metadata={title:"Коллекции"};
export default async function Collections({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const ctx=await memberContext();const page=pageNumber((await searchParams).page);const rows=await collectionRows(ctx.uid,ctx.uid,page);
  return <div className="catalog-page"><h1><I18nText text={"Мои коллекции"}/></h1><details className="social-card"><summary><I18nText text={"Создать коллекцию"}/></summary><ActionForm op="collection-create" label="Создать" reset><label className="field"><I18nText text={"Название"}/><input name="title" maxLength={100} required/></label><label className="field"><I18nText text={"Описание"}/><textarea name="description" maxLength={2000}/></label><label className="check-field"><input type="checkbox" name="public"/><I18nText text={"Открытая коллекция"}/></label></ActionForm></details><CollectionCards rows={rows}/><PageNav page={page} hasNext={rows.length===24} base="/collections"/></div>;
}
