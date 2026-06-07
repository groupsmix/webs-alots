"use client";
/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */

import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";
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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/super-admin/ops-summary", { cache: "no-store" });
        if (!response.ok) return;
        const json = (await response.json()) as OpsSummaryResponse;
        if (active && json.ok) {
          setData(json.data);
        }
      } catch {}
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
    data && !data.compliance.cndpApproved ? "CNDP pending" : null,
    (data?.compliance.overdueDsarCount ?? 0) > 0
      ? `${data?.compliance.overdueDsarCount} DSAR overdue`
      : null,
    (data?.compliance.activeBreachCount ?? 0) > 0 ? "Active breach" : null,
  ].filter(Boolean);

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
              {downServices.length} service(s) en panne: {downServices.join(", ")}
            </span>
          </>
        )}
      </Link>
      <div className="h-4 w-px bg-border" />
      <Link href="/super-admin/compliance" className="flex items-center gap-2">
        {complianceIssues.length === 0 ? (
          <>
            <Shield className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Compliance: OK</span>
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
          System
        </Link>
        <span>·</span>
        <Link href="/super-admin/compliance" className="hover:text-foreground">
          Compliance
        </Link>
        <span>·</span>
        <Link href="/dsar-request" className="hover:text-foreground">
          DSAR public
        </Link>
      </div>
    </div>
  );
}
