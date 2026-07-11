"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  dictionaries,
  defaultLocale,
  localeDir,
  type Dictionary,
  type Locale,
} from "./dictionaries";

type I18nValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  dict: Dictionary;
  setLocale: (l: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = "oltigo.locale";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // Hydrate from storage / browser without causing a mismatch (runs post-mount).
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const stored = (typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_KEY)) as Locale | null;

    if (stored && stored in dictionaries) {
      timeouts.push(
        setTimeout(() => {
          setLocaleState(stored);
        }, 0),
      );
    }

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Reflect locale onto <html> for native dir/lang + font switching.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = localeDir[locale];
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, []);

  const value: I18nValue = {
    locale,
    dir: localeDir[locale],
    dict: dictionaries[locale],
    setLocale,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <LanguageProvider>");
  return ctx;
}
