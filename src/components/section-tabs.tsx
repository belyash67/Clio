import Link from "next/link";
import {I18nText,LocalizedNav} from "./i18n";

export function SectionTabs({items,active}:{items:{id:string;label:string;href:string;count?:number}[];active:string}){
  return <LocalizedNav className="section-tabs" aria-label="Разделы">{items.map(item=><Link key={item.id} href={item.href} aria-current={item.id===active?"page":undefined}><I18nText text={item.label}/>{Boolean(item.count)&&<span className="tab-count">{item.count}</span>}</Link>)}</LocalizedNav>;
}
