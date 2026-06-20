"use client";
/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */

import { AlertTriangle, CheckCircle2, Shield, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface OpsSummaryResponse {
  ok: true;
  data: {
    compliance: {
      cndpApproved: boolean;
      overdueDsarCount: number;
      activeBreachCount: number;
    };
    uptime: {
      downServices: string[];
      monitorCount: number;
    };
    fetchedAt: string;
  };
}

export function OpsSummaryStrip() {
  const [data, setData] = useState<OpsSummaryResponse["data"] | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (active) setFetchError(false);
      try {
        const response = await fetch("/api/super-admin/ops-summary", { cache: "no-store" });
        if (!response.ok) {
          if (active) setFetchError(true);
          return;
        }
        const json = (await response.json()) as OpsSummaryResponse;
        if (active && json.ok) {
          setData(json.data);
        } else if (active) {
          setFetchError(true);
        }
      } catch {
        if (active) setFetchError(true);
      }
    }

    void load();
    const interval = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const downServices = data?.uptime.downServices ?? [];
  const complianceIssues = [
    data && !data.compliance.cndpApproved ? "CNDP en attente" : null,
    (data?.compliance.overdueDsarCount ?? 0) > 0
      ? `${data?.compliance.overdueDsarCount} DSAR en retard`
      : null,
    (data?.compliance.activeBreachCount ?? 0) > 0 ? "Incident actif" : null,
  ].filter(Boolean);

  // B4 fix: when the ops-summary API is unreachable (geo-block, network error,
  // or any non-2xx), show an explicit "data unavailable" state rather than
  // silently rendering the green "all operational" placeholder.
  if (fetchError) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
        <Link href="/super-admin/system" className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground italic">
            Données système indisponibles — vérifiez votre connexion ou{" "}
            <span className="underline">le tableau de bord système</span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/super-admin/system" className="hover:text-foreground">
            Système
          </Link>
          <span>·</span>
          <Link href="/super-admin/compliance" className="hover:text-foreground">
            Conformité
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
      <Link href="/super-admin/system" className="flex items-center gap-2">
        {downServices.length === 0 ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Tous les services sont opérationnels</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-medium text-destructive">
              {downServices.length} service(s) en panne : {downServices.join(", ")}
            </span>
          </>
        )}
      </Link>
      <div className="h-4 w-px bg-border" />
      <Link href="/super-admin/compliance" className="flex items-center gap-2">
        {complianceIssues.length === 0 ? (
          <>
            <Shield className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Conformité : OK</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-medium text-destructive">
              {complianceIssues[0]}
              {complianceIssues.length > 1 ? ` +${complianceIssues.length - 1}` : ""}
            </span>
          </>
        )}
      </Link>
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/super-admin/system" className="hover:text-foreground">
          Système
        </Link>
        <span>·</span>
        <Link href="/super-admin/compliance" className="hover:text-foreground">
          Conformité
        </Link>
        <span>·</span>
        <Link href="/dsar-request" className="hover:text-foreground">
          DSAR public
        </Link>
      </div>
    </div>
  );
}
