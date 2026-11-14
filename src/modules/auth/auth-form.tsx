"use client";
import { I18nText } from "@/components/i18n";


import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { registrationSchema } from "@/lib/validation";
import { authErrorMessage } from "@/lib/auth-errors";
import { forgetVerificationEmail, getVerificationEmail, rememberVerificationEmail, subscribeVerificationEmail } from "@/lib/pending-verification";

type Mode = "login" | "register" | "forgot" | "reset" | "verify";
const titles: Record<Mode, string> = { login: "С возвращением", register: "Начни свою историю", forgot: "Восстановить доступ", reset: "Новый пароль", verify: "Подтвердить email" };
const labels: Record<Mode, string> = { login: "Войти", register: "Создать аккаунт", forgot: "Получить письмо", reset: "Сохранить пароль", verify: "Отправить письмо повторно" };

export function AuthForm({ mode, ready, token }: { mode: Mode; ready: boolean; token?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const rememberedEmail = useSyncExternalStore(subscribeVerificationEmail, getVerificationEmail, () => "");
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending || cooldown > 0) return;
    const values = new FormData(event.currentTarget);
    const field = (name: string) => String(values.get(name) ?? "");
    setMessage("");
    setPending(true);
    try {
      let error: { message?: string; status?: number; code?: string } | null = null;
      if (mode === "register") {
        const parsed = registrationSchema.safeParse(Object.fromEntries(values));
        if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Проверь поля формы."); return; }
        const result = await authClient.signUp.email({
          name: parsed.data.name, username: parsed.data.username, email: parsed.data.email,
          password: parsed.data.password, callbackURL: "/login?verified=1",
        });
        error = result.error;
        if (!error) { rememberVerificationEmail(parsed.data.email); router.push("/verify"); return; }
      } else if (mode === "login") {
        const result = await authClient.signIn.email({ email: field("email").trim().toLowerCase(), password: field("password") });
        error = result.error;
        if (!error) { forgetVerificationEmail(); router.replace("/profile"); router.refresh(); return; }
        if (error.code === "EMAIL_NOT_VERIFIED") {
          rememberVerificationEmail(field("email").trim().toLowerCase());
          router.push("/verify"); return;
        }
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email: field("email").trim().toLowerCase(), redirectTo: "/reset-password" });
        error = result.error;
      } else if (mode === "verify") {
        const email = rememberedEmail || field("email").trim().toLowerCase();
        const result = await authClient.sendVerificationEmail({ email, callbackURL: "/login?verified=1" });
        error = result.error;
        if (!error) { rememberVerificationEmail(email); setCooldown(60); }
      } else {
        if (!token) { setMessage("Ссылка недействительна. Запроси новое письмо."); return; }
        if (field("password") !== field("confirmPassword")) { setMessage("Пароли не совпадают."); return; }
        const result = await authClient.resetPassword({ token, newPassword: field("password") });
        error = result.error;
        if (!error) { router.replace("/login?reset=1"); return; }
      }
      setMessage(error
        ? mode === "verify" && error.status && error.status >= 500
          ? "Не удалось отправить письмо. Почтовый сервер временно недоступен. Аккаунт сохраняется — попробуй повторить отправку позже."
          : authErrorMessage(error)
        : "Если этот адрес подходит для операции, письмо будет отправлено. Проверь также папку «Спам».");
    } catch { setMessage("Не удалось связаться с сервером. Попробуй позже."); }
    finally { setPending(false); }
  }

  return <div className="auth-layout"><Link href="/" className="eyebrow">← CLIO</Link><h1><I18nText text={titles[mode]}/></h1>
    {mode === "register" && <p><I18nText text={"Сохрани место для своей истории кино."}/></p>}
    {mode === "verify" && <><p><I18nText text={"Для входа подтверди email по ссылке из письма."}/>{" "}{rememberedEmail && <><I18nText text={"Адрес подтверждения:"}/>{" "}<strong>{rememberedEmail}</strong>. </>}<I18nText text={"Проверь также папку «Спам». Если письма нет, отправь его повторно."}/></p>{rememberedEmail && <button type="button" className="text-link" disabled={pending} onClick={() => { forgetVerificationEmail(); setMessage(""); }}><I18nText text={"Указать email другого аккаунта"}/></button>}</>}
    {!ready && <p className="notice" role="status"><I18nText text={"Вход и регистрация пока недоступны: база данных и почта ещё не настроены."}/></p>}
    <form onSubmit={submit} aria-busy={pending}>
      {mode === "register" && <><label className="field"><I18nText text={"Как тебя зовут"}/><input name="name" required minLength={1} maxLength={60} autoComplete="name" /></label><label className="field">Username<input name="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" autoComplete="username" aria-describedby="username-help" /><span id="username-help" className="muted"><I18nText text={"3–30 символов: латинские буквы, цифры, _"}/></span></label></>}
      {mode !== "reset" && !(mode === "verify" && rememberedEmail) && <label className="field">Email<input type="email" name="email" required autoComplete="email" maxLength={254} /></label>}
      {(mode === "register" || mode === "login" || mode === "reset") && <label className="field"><I18nText text={"Пароль"}/><input type="password" name="password" required minLength={mode === "login" ? 1 : 12} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} />{mode !== "login" && <span className="muted"><I18nText text={"От 12 до 128 символов."}/></span>}</label>}
      {(mode === "register" || mode === "reset") && <label className="field"><I18nText text={"Повтори пароль"}/><input type="password" name="confirmPassword" required minLength={12} maxLength={128} autoComplete="new-password" /></label>}
      {message && <div className="feedback" role="status"><I18nText text={message}/></div>}
      <button className="button primary" disabled={!ready || pending || cooldown > 0 || (mode === "reset" && !token)}><I18nText text={pending ? "Подожди…" : cooldown > 0 ? `Повторить через ${cooldown} с` : labels[mode]}/></button>
    </form>
    {mode === "login" ? <><p><Link href="/forgot-password"><I18nText text={"Забыли пароль?"}/></Link> · <Link href="/verify"><I18nText text={"Подтвердить email"}/></Link></p><p><I18nText text={"Первый раз здесь?"}/>{" "}<Link href="/register"><I18nText text={"Создать аккаунт"}/></Link></p></> : <p><Link href="/login"><I18nText text={"Перейти ко входу"}/></Link></p>}
  </div>;
}
