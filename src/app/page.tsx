import Link from "next/link";
import {headers} from "next/headers";
import {isConfigured} from "@/server/config";
import {getAuth} from "@/server/auth";
import {HomeDashboard} from "@/modules/library/home-dashboard";
import {I18nText} from "@/components/i18n";

export const dynamic="force-dynamic";
export default async function Home(){
  const ready=isConfigured();const session=ready?await getAuth().api.getSession({headers:await headers()}):null;
  if(session)return <HomeDashboard/>;
  return <div className="welcome-page"><span className="welcome-mark">clio<span>.</span></span><h1><I18nText text="Твоё кино."/><br/><span><I18nText text="Твои люди."/></span></h1><p><I18nText text="Сохраняй фильмы. Делись впечатлениями."/></p><Link className="button primary" href="/register"><I18nText text="Создать аккаунт"/></Link><Link className="button secondary" href="/login"><I18nText text="Войти"/></Link><Link className="text-link" href="/catalog"><I18nText text="Посмотреть каталог"/></Link>{!ready&&<p className="notice"><I18nText text="Clio готовится к первым историям. Регистрация откроется после подключения базы данных и почты."/></p>}</div>;
}
