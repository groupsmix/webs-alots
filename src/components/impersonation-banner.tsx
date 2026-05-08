"use client";

/**
 * Impersonation Banner
 *
 * Displays a visible warning banner when a super admin is impersonating
 * a clinic. Because the impersonation cookies are `httpOnly: true`
 * (S-11) the banner cannot read them via `document.cookie`; instead it
 * fetches the current impersonation state from `GET /api/impersonate`.
 */

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";

interface ImpersonationState {
  clinicName: string | null;
  reason: string | null;
}

export function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState>({ clinicName: null, reason: null });
  const [ending, setEnding] = useState(false);
  const [locale] = useLocale();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/impersonate", {
          method: "GET",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { ok?: boolean; data?: ImpersonationState };
        if (!cancelled && body?.ok && body.data) {
          setState({
            clinicName: body.data.clinicName ?? null,
            reason: body.data.reason ?? null,
          });
        }
      } catch (err) {
        logger.warn("Failed to fetch impersonation state", {
          context: "impersonation-banner",
          error: err,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state.clinicName) return null;

  async function endImpersonation() {
    setEnding(true);
    try {
      await fetch("/api/impersonate", { method: "DELETE" });
      window.location.href = "/super-admin/clinics";
    } catch (err) {
      logger.warn("Failed to end impersonation session", { context: "impersonation-banner", error: err });
      setEnding(false);
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        {t(locale, "impersonation.viewingAs")} <strong>{state.clinicName}</strong> {t(locale, "impersonation.sessionActive")}
        {state.reason && (
          <span className="ml-1 text-amber-800">
            ({t(locale, "impersonation.reason").replace("{reason}", state.reason)})
          </span>
        )}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="ml-2 h-7 border-amber-700 bg-amber-600 text-amber-50 hover:bg-amber-700 hover:text-white"
        onClick={endImpersonation}
        disabled={ending}
      >
        <X className="h-3 w-3 mr-1" />
        {t(locale, "impersonation.endSession")}
      </Button>
    </div>
  );
}
