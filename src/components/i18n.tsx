"use client";
import {createContext,useContext} from "react";
import {translate,type Language} from "@/i18n/dictionary";
import type {ComponentProps} from "react";

const LanguageContext=createContext<Language>("ru");
export function LanguageProvider({language,children}:{language:Language;children:React.ReactNode}) {return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;}
export function I18nText({text}:{text:string}) {return translate(text,useContext(LanguageContext));}
export function useTranslate(){const language=useContext(LanguageContext);return (text:string)=>translate(text,language);}
export function LocalizedInput(props:ComponentProps<"input">){const t=useTranslate();return <input {...props} placeholder={props.placeholder?t(props.placeholder):undefined} title={props.title?t(props.title):undefined} aria-label={props["aria-label"]?t(props["aria-label"]):undefined}/>;}
export function LocalizedTextarea(props:ComponentProps<"textarea">){const t=useTranslate();return <textarea {...props} placeholder={props.placeholder?t(props.placeholder):undefined}/>;}
export function LocalizedNav(props:ComponentProps<"nav">){const t=useTranslate();return <nav {...props} aria-label={props["aria-label"]?t(props["aria-label"]):undefined}/>;}
