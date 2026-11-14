import Link from "next/link";
import {eq} from "drizzle-orm";
import {requireSession} from "@/server/session";
import {getDb} from "@/server/db";
import {user,userSettings} from "@/server/db/schema";
import {I18nText} from "@/components/i18n";
import {MenuLink,IconLink} from "@/components/mobile-ui";
import {ThemeSelect} from "@/components/theme-select";
import {PwaControls} from "@/components/pwa-controls";
import {ProfileForm,SignOut} from "@/modules/profiles/profile-form";
import {AccountSettings} from "@/modules/profiles/account-settings";
import {AccountSecurity} from "@/modules/auth/account-security";

export const metadata={title:"Настройки"};
export default async function Settings({searchParams}:{searchParams:Promise<{section?:string}>}){
  const session=await requireSession();const db=getDb();const p=await searchParams;
  const [[profile],[settings]]=await Promise.all([db.select().from(user).where(eq(user.id,session.user.id)),db.select().from(userSettings).where(eq(userSettings.userId,session.user.id))]);
  const sections:Record<string,string>={profile:"Профиль и приватность",username:"Изменить username",email:"Email",security:"Безопасность аккаунта",preferences:"Язык и уведомления",appearance:"Оформление",app:"Приложение",delete:"Удаление аккаунта"};
  const section=p.section&&Object.hasOwn(sections,p.section)?p.section:"";
  return <div className="settings-page"><div className="page-heading"><IconLink href={section?"/settings":"/profile"} label="Назад" icon="back"/><h1><I18nText text={section?sections[section]:"Настройки"}/></h1></div>
    {!section&&<><div className="menu-list"><MenuLink href="/settings?section=profile" label="Профиль и приватность" icon="profile"/><MenuLink href="/settings?section=username" label="Изменить username" icon="profile"/><MenuLink href="/settings?section=email" label="Email" icon="email"/><MenuLink href="/settings?section=security" label="Безопасность аккаунта" icon="security"/><MenuLink href="/settings?section=preferences" label="Язык и уведомления" icon="language"/><MenuLink href="/settings?section=appearance" label="Оформление" icon="appearance"/><MenuLink href="/settings?section=app" label="Приложение" icon="app"/></div><div className="settings-exit"><SignOut/></div><div className="danger-zone"><MenuLink href="/settings?section=delete" label="Удаление аккаунта" icon="security"/></div></>}
    {section==="profile"&&<ProfileForm profile={{name:profile.name,bio:profile.bio,profileVisibility:settings?.profileVisibility??"friends",libraryVisibility:settings?.libraryVisibility??"private",activityVisibility:settings?.activityVisibility??"private"}}/>}
    {section==="security"&&<AccountSecurity/>}
    {(["username","email","preferences","delete"] as const).map(item=>section===item&&<AccountSettings key={item} section={item} username={profile.username} language={settings?.language??"ru"} notificationsEnabled={settings?.notificationsEnabled??true}/>)}
    {section==="appearance"&&<div className="settings-card"><ThemeSelect/></div>}
    {section==="app"&&<div className="settings-card"><PwaControls/><Link className="menu-link" href="/credits"><I18nText text="Источники данных"/></Link></div>}
  </div>;
}
