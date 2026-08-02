"use client";

import Cookies from "js-cookie";
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
// Sync with the app-wide locale key so the global cookie banner reads the same value.
const PREFERRED_LOCALE_KEY = "preferred-locale";

function isValidLocale(value: unknown): value is Locale {
  return typeof value === "string" && value in dictionaries;
}

function syncLocale(l: Locale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, l);
    window.localStorage.setItem(PREFERRED_LOCALE_KEY, l);
    Cookies.set(PREFERRED_LOCALE_KEY, l, {
      expires: 365,
      path: "/",
      secure: window.location.protocol === "https:",
      sameSite: "lax",
    });
    window.dispatchEvent(new CustomEvent("oltigo:locale", { detail: l }));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // Hydrate from storage / browser without causing a mismatch (runs post-mount).
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const stored =
      (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) ||
      (typeof window !== "undefined" && window.localStorage.getItem(PREFERRED_LOCALE_KEY)) ||
      null;

    if (isValidLocale(stored)) {
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
    syncLocale(l);
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
