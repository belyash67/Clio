"use client";
import { I18nText } from "@/components/i18n";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Film } from "lucide-react";
import { posterUrl } from "./contracts";

export function Poster({ path, title,eager=false }: { path: string | null; title: string;eager?:boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [retry,setRetry]=useState<{url:string;count:number}|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const url = posterUrl(path);
  const attempt=retry?.url===url?retry.count:0;
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[url]);
  return <div className="poster">{url && failedUrl !== url
    ? <Image key={`${url}:${attempt}`} src={url} alt={`Постер «${title}»`} fill unoptimized loading={eager?"eager":"lazy"} fetchPriority={eager?"high":undefined} sizes="(max-width: 640px) 45vw, 220px" onError={() => {if(attempt<2){if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setRetry({url,count:attempt+1}),1500);}else setFailedUrl(url);}} />
    : <div className="poster-empty"><Film size={32} aria-hidden /><span>{url ? <I18nText text={"Постер недоступен"}/> : <I18nText text={"Без постера"}/>}</span></div>}</div>;
}
