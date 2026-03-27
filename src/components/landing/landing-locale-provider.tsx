"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLocale } from "@/components/locale-switcher";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";

interface LandingLocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LandingLocaleContext = createContext<LandingLocaleContextValue | null>(null);

export function useLandingLocale(): LandingLocaleContextValue {
  const ctx = useContext(LandingLocaleContext);
  if (!ctx) {
    throw new Error("useLandingLocale must be used within LandingLocaleProvider");
  }
  return ctx;
}

export function LandingLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useLocale();

  const translate = (key: TranslationKey) => t(locale, key);

  return (
    <LandingLocaleContext.Provider value={{ locale, setLocale, t: translate }}>
      {children}
    </LandingLocaleContext.Provider>
  );
}
