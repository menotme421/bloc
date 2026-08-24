"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase/client";
import { dictionaries, type Locale, type Dictionary } from "@/lib/i18n/dictionaries";

const STORAGE_KEY = "bloc:locale";
export const DEFAULT_LOCALE: Locale = "en";

function normalizeLocale(raw: string | null | undefined): Locale {
  if (!raw) return DEFAULT_LOCALE;
  const lower = raw.toLowerCase();
  // explicit matches
  if (lower === "zh-tw" || lower === "zh-hant" || lower === "zh-hk" || lower === "zh-mo") return "zh-TW";
  if (lower === "zh-cn" || lower === "zh-hans" || lower === "zh-sg" || lower === "zh" || lower.startsWith("zh-")) {
    // zh default to zh-CN unless hant/tw/hk/mo
    if (lower.includes("hant") || lower.includes("tw") || lower.includes("hk") || lower.includes("mo")) return "zh-TW";
    return "zh-CN";
  }
  if (lower.startsWith("ms")) return "ms";
  if (lower.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}

function getInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && (stored === "en" || stored === "ms" || stored === "zh-CN" || stored === "zh-TW")) {
      return stored;
    }
    const nav = navigator.language;
    return normalizeLocale(nav);
  }
  return DEFAULT_LOCALE;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (path: string, params?: Record<string, string>) => string;
  dict: Dictionary;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

function lookup(dict: Dictionary, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(() => getInitialLocale());
  const [hydrated, setHydrated] = React.useState(false);

  // hydrate from stored locale (ensures SSR fallback then client correct)
  React.useEffect(() => {
    const initial = getInitialLocale();
    if (initial !== locale) setLocaleState(initial);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync from cloud on mount (hybrid: cloud overrides after auth, but user explicit choice wins if local exists)
  React.useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase.from("profiles").select("locale").eq("id", user.id).maybeSingle();
        const cloudLocale = (data as { locale?: string } | null)?.locale as Locale | undefined;
        if (!cloudLocale || cancelled) return;
        const valid = ["en", "ms", "zh-CN", "zh-TW"].includes(cloudLocale);
        if (!valid) return;
        // if local explicit exists (~= user ever set), respect local; else adopt cloud
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          window.localStorage.setItem(STORAGE_KEY, cloudLocale);
          setLocaleState(cloudLocale as Locale);
          document.documentElement.lang = cloudLocale;
        } else if (stored !== cloudLocale) {
          // optionally keep local as source of truth; push local to cloud if divergent
          await supabase.from("profiles").update({ locale: stored } as never).eq("id", user.id);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [hydrated]);

  // html lang sync
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    document.documentElement.lang = next;
    // sync to profiles.locale (hybrid)
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("profiles").update({ locale: next } as never).eq("id", user.id);
      } catch {}
    })();
  }, []);

  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];

  const t = React.useCallback((path: string, params?: Record<string, string>) => {
    const val = lookup(dict, path) ?? lookup(dictionaries[DEFAULT_LOCALE], path) ?? path;
    if (!params) return val;
    let out = val;
    for (const [k, v] of Object.entries(params)) {
      out = out.replaceAll(`{${k}}`, v);
    }
    return out;
  }, [dict]);

  const value = React.useMemo(() => ({ locale, setLocale, t, dict }), [locale, setLocale, t, dict]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
