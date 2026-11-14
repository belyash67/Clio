"use client";
import { I18nText } from "@/components/i18n";

import { useState } from "react";
import { saveProfile } from "./actions";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type Visibility = "private" | "friends" | "public";
export function ProfileForm({ profile }: { profile: { name: string; bio: string; profileVisibility: Visibility; libraryVisibility: Visibility; activityVisibility: Visibility } }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return <form aria-busy={pending} onSubmit={async (event) => {
    event.preventDefault(); setPending(true); setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { const result = await saveProfile(data); setMessage(result.message); }
    catch { setMessage("Сессия истекла или сервер недоступен. Попробуй войти снова."); }
    finally { setPending(false); }
  }}>
    <label className="field"><I18nText text={"Имя"}/><input name="name" defaultValue={profile.name} minLength={1} maxLength={60} required autoComplete="name" /></label>
    <label className="field"><I18nText text={"О себе"}/><textarea name="bio" defaultValue={profile.bio} maxLength={500} /></label>
    {([{ name: "profileVisibility", label: "Кто видит профиль" }, { name: "libraryVisibility", label: "Кто видит библиотеку" }, { name: "activityVisibility", label: "Кто видит активность" }] as const).map(({ name, label }) => <label className="field" key={name}><I18nText text={label}/><select name={name} defaultValue={name==="profileVisibility"&&profile[name]==="private"?"friends":profile[name]}>{name!=="profileVisibility"&&<option value="private"><I18nText text={"Только я"}/></option>}<option value="friends"><I18nText text={"Друзья"}/></option><option value="public"><I18nText text={"Все"}/></option></select></label>)}
    <p className="muted"><I18nText text="Подтверждённые друзья всегда видят профиль. Библиотека, активность и публикации имеют отдельные настройки приватности. Для поиска другими людьми выбери «Все»."/></p>
    {message && <p role="status" className="feedback"><I18nText text={message}/></p>}
    <button className="button primary" disabled={pending}>{pending ? <I18nText text={"Сохраняем…"}/> : <I18nText text={"Сохранить изменения"}/>}</button>
  </form>;
}

export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div><button className="button secondary" disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) { setError("Не удалось выйти. Попробуй ещё раз."); return; }
      window.location.replace("/login");
    } catch { setError("Сервер недоступен."); }
    finally { setPending(false); router.refresh(); }
  }}><I18nText text={"Выйти"}/></button>{error && <p role="status">{error}</p>}</div>;
}
