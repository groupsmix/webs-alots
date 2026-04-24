"use client";

import { Clock } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

interface SessionTimeoutWarningProps {
  /** Minutes of inactivity before showing warning */
  warningAfterMinutes?: number;
  /** Minutes after warning before auto-logout */
  logoutAfterMinutes?: number;
  onExtendSession?: () => void;
  onLogout?: () => void;
}

export function SessionTimeoutWarning({
  warningAfterMinutes = 25,
  logoutAfterMinutes = 5,
  onExtendSession,
  onLogout,
}: SessionTimeoutWarningProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(logoutAfterMinutes * 60);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [locale] = useLocale();

  const resetTimer = useCallback(() => {
    setShowWarning(false);
    setRemainingSeconds(logoutAfterMinutes * 60);

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(logoutAfterMinutes * 60);

      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            onLogout?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningAfterMinutes * 60 * 1000);
  }, [warningAfterMinutes, logoutAfterMinutes, onLogout]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    const handleActivity = () => {
      if (!showWarning) resetTimer();
    };

    events.forEach((event) => document.addEventListener(event, handleActivity));

    // Start timer on mount via ref to avoid setState-in-effect warning
    const timerId = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(logoutAfterMinutes * 60);

      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            onLogout?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningAfterMinutes * 60 * 1000);
    warningTimerRef.current = timerId;

    return () => {
      events.forEach((event) => document.removeEventListener(event, handleActivity));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetTimer, showWarning, logoutAfterMinutes, onLogout, warningAfterMinutes]);

  const handleExtend = () => {
    resetTimer();
    onExtendSession?.();
  };

  if (!showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60" role="alertdialog" aria-labelledby="session-timeout-title">
      <div className="mx-4 w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
            <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h2 id="session-timeout-title" className="font-semibold">{t(locale, "session.expiring")}</h2>
            <p className="text-sm text-muted-foreground">
              {t(locale, "session.logoutIn").replace("{time}", `${minutes}:${seconds.toString().padStart(2, "0")}`)}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t(locale, "session.expiryMessage")}
        </p>
        <div className="flex gap-2">
          <Button onClick={handleExtend} className="flex-1">
            {t(locale, "session.stayConnected")}
          </Button>
          <Button variant="outline" onClick={onLogout} className="flex-1">
            {t(locale, "session.logout")}
          </Button>
        </div>
      </div>
    </div>
  );
}
