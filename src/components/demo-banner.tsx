"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Banner displayed on the demo tenant to indicate it's a demonstration environment.
 * Shows at the top of every page when the current subdomain is "demo".
 */
export function DemoBanner() {
  return (
    <div
      role="alert"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Mode démo — Les données sont fictives et les modifications ne sont pas enregistrées.
      </span>
      <a
        href="/register"
        className="ml-2 inline-flex items-center rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white transition-colors hover:bg-white/30"
      >
        Créer votre clinique
      </a>
    </div>
  );
}
