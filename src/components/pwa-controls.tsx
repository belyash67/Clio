"use client";
import {createContext,useContext,useEffect,useRef,useState} from "react";
import {I18nText,useTranslate} from "./i18n";

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
type PwaState={install:InstallEvent|null;waiting:ServiceWorker|null;prompt:()=>Promise<void>;update:()=>void};
const PwaContext=createContext<PwaState>({install:null,waiting:null,prompt:async()=>{},update:()=>{}});
export function PwaProvider({children}:{children:React.ReactNode}){
  const [install,setInstall]=useState<InstallEvent|null>(null);const [waiting,setWaiting]=useState<ServiceWorker|null>(null);
  const updateRequested=useRef(false);const t=useTranslate();
  useEffect(()=>{
    if(!("serviceWorker"in navigator))return;
    const installHandler=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent);};
    window.addEventListener("beforeinstallprompt",installHandler);
    let active=true;let reloading=false;
    const reload=()=>{if(updateRequested.current&&!reloading){reloading=true;window.location.reload();}};
    navigator.serviceWorker.addEventListener("controllerchange",reload);
    navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(registration=>{
      if(!active)return;if(registration.waiting)setWaiting(registration.waiting);
      registration.addEventListener("updatefound",()=>{const worker=registration.installing;worker?.addEventListener("statechange",()=>{if(active&&worker.state==="installed"&&navigator.serviceWorker.controller)setWaiting(worker);});});
    }).catch(()=>{});
    return()=>{active=false;window.removeEventListener("beforeinstallprompt",installHandler);navigator.serviceWorker.removeEventListener("controllerchange",reload);};
  },[]);
  const prompt=async()=>{if(!install)return;await install.prompt();await install.userChoice;setInstall(null);};
  const update=()=>{if(waiting&&window.confirm(t("Обновить Clio? Несохранённые поля формы будут потеряны."))){updateRequested.current=true;waiting.postMessage({type:"ACTIVATE_UPDATE"});}};
  return <PwaContext.Provider value={{install,waiting,prompt,update}}>{children}</PwaContext.Provider>;
}
export function PwaControls(){
  const {install,waiting,prompt,update}=useContext(PwaContext);
  return <div className="pwa-settings">{install&&<button className="button primary" onClick={prompt}><I18nText text="Установить Clio"/></button>}{waiting&&<button className="button secondary" onClick={update}><I18nText text="Доступно обновление"/></button>}<details><summary><I18nText text="Установка на устройство"/></summary><p><I18nText text="Android/Windows/macOS: меню браузера → «Установить приложение», если доступно. iPhone/iPad: Safari → «Поделиться» → «На экран Домой»."/></p></details></div>;
}
