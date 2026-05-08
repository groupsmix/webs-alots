"use client";

/**
 * Locale Switcher Component
 *
 * Allows users to switch between French, Arabic, and English.
 * Persists the choice in localStorage and applies RTL direction for Arabic.
 */

import Cookies from "js-cookie";
import { Globe } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { type Locale, isRTL, getDirection } from "@/lib/i18n";

const LOCALE_STORAGE_KEY = "preferred-locale";

const LOCALE_LABELS: Record<Locale, { label: string; flag: string }> = {
  fr: { label: "Français", flag: "🇫🇷" },
  ar: { label: "العربية", flag: "🇲🇦" },
  en: { label: "English", flag: "🇬🇧" },
};

interface LocaleSwitcherProps {
  className?: string;
  onLocaleChange?: (locale: Locale) => void;
}

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "fr";
  const stored = Cookies.get(LOCALE_STORAGE_KEY) || localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "fr" || stored === "ar" || stored === "en") return stored;
  return "fr";
}

export function useLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  useEffect(() => {
    applyDirection(locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, l);
      Cookies.set(LOCALE_STORAGE_KEY, l, { expires: 365, path: "/" });
    }
    applyDirection(l);
  }, []);

  return [locale, setLocale];
}

function applyDirection(locale: Locale) {
  if (typeof document === "undefined") return;
  const dir = getDirection(locale);
  document.documentElement.dir = dir;
  document.documentElement.lang = locale;
  if (isRTL(locale)) {
    document.documentElement.classList.add("rtl");
  } else {
    document.documentElement.classList.remove("rtl");
  }
}

export function LocaleSwitcher({ className, onLocaleChange }: LocaleSwitcherProps) {
  const [locale, setLocale] = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (l: Locale) => {
    setLocale(l);
    setIsOpen(false);
    onLocaleChange?.(l);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        aria-label="Switch language"
      >
        <Globe className="h-4 w-4" />
        <span>{LOCALE_LABELS[locale].flag}</span>
        <span className="hidden sm:inline">{LOCALE_LABELS[locale].label}</span>
      </button>

      {isOpen && (
        <>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard interaction handled by parent or child interactive element */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-1 right-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
            {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => handleSelect(l)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  locale === l
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : ""
                }`}
              >
                <span className="text-lg">{LOCALE_LABELS[l].flag}</span>
                <span>{LOCALE_LABELS[l].label}</span>
                {locale === l && (
                  <span className="ml-auto text-blue-500">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
