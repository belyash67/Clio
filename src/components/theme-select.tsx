"use client";
import { I18nText } from "@/components/i18n";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return <label className="theme-select"><I18nText text={"Тема"}/>{" "}<select aria-label="Тема оформления" value={mounted ? theme : "dark"} disabled={!mounted} onChange={(event) => setTheme(event.target.value)}>
    <option value="dark"><I18nText text={"Тёмная"}/></option><option value="light"><I18nText text={"Светлая"}/></option><option value="system"><I18nText text={"Системная"}/></option>
  </select></label>;
}
