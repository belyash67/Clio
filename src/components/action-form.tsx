"use client";
import { I18nText,useTranslate } from "@/components/i18n";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { performAction } from "@/modules/social/actions";

export function ActionForm({ op, fields = {}, label, children, danger = false, reset = false, closeOnSuccess=false,buttonContent }: { op: string; fields?: Record<string, string>; label: string; children?: React.ReactNode; danger?: boolean; reset?: boolean;closeOnSuccess?:boolean;buttonContent?:React.ReactNode }) {
  const [state, action, pending] = useActionState(performAction, { ok: false, message: "" });
  const ref = useRef<HTMLFormElement>(null); const router = useRouter();
  const t=useTranslate();
  useEffect(() => { if (state.ok) { if (reset) ref.current?.reset(); if(closeOnSuccess)ref.current?.dispatchEvent(new CustomEvent("clio:saved",{bubbles:true})); if(state.href)router.push(state.href);else router.refresh(); } }, [state, reset, router,closeOnSuccess]);
  return <form ref={ref} action={action} className="action-form" onSubmit={(event) => { if (danger && !window.confirm(t("Подтвердить удаление?"))) event.preventDefault(); }}>
    <input type="hidden" name="op" value={op} />{Object.entries(fields).map(([key, val]) => <input type="hidden" name={key} value={val} key={key} />)}
    <fieldset disabled={pending}>{children}<button className={`button ${danger ? "danger" : "secondary"} ${buttonContent?"compact-action":""}`} aria-label={buttonContent?t(label):undefined} disabled={pending}>{buttonContent??<I18nText text={pending ? "Сохраняем…" : label}/>}</button></fieldset>
    {state.message && (!state.ok||!buttonContent) && <p role="status" className={state.ok ? "form-success" : "feedback"}><I18nText text={state.message}/> {state.href && <Link className="text-link" href={state.href}><I18nText text={"Открыть →"}/></Link>}</p>}
  </form>;
}
