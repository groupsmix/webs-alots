"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";

export function OfflineIndicator() {
  const [locale] = useLocale();
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" ? !navigator.onLine : false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className={cn(
        "fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 shadow-lg",
        "dark:border-yellow-800 dark:bg-yellow-950",
        "animate-in slide-in-from-bottom-4 fade-in-0 motion-reduce:animate-none"
      )}
    >
      <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
        {t(locale, "offline.message")}
      </span>
    </div>
  );
}
