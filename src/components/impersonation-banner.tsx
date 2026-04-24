"use client";

/**
 * Impersonation Banner
 *
 * Displays a visible warning banner when a super admin is impersonating
 * a clinic. Reads the impersonation cookie and shows the clinic name
 * with an option to end the session.
 */

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function ImpersonationBanner() {
  const [clinicName] = useState<string | null>(() => getCookie("sa_impersonate_clinic_name"));
  const [reason] = useState<string | null>(() => getCookie("sa_impersonate_reason"));
  const [ending, setEnding] = useState(false);
  const [locale] = useLocale();

  if (!clinicName) return null;

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
        {t(locale, "impersonation.viewingAs")} <strong>{clinicName}</strong> {t(locale, "impersonation.sessionActive")}
        {reason && <span className="ml-1 text-amber-800">({t(locale, "impersonation.reason").replace("{reason}", reason)})</span>}
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
