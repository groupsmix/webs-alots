"use client";

import { AlertTriangle, Clock, ShieldAlert, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ComplianceSnapshot {
  cndpStatus: string | null;
  openDsars: number;
  overdueDsars: number;
  activeBreaches: number;
}

export function ComplianceWidget() {
  const [snapshot, setSnapshot] = useState<ComplianceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/super-admin/compliance-snapshot", {
          cache: "no-store",
        });
        if (response.ok) {
          const json = (await response.json()) as {
            ok?: boolean;
            data?: ComplianceSnapshot;
          };
          if (json.data) setSnapshot(json.data);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4" />
            Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const s = snapshot ?? { cndpStatus: null, openDsars: 0, overdueDsars: 0, activeBreaches: 0 };
  const hasIssues = s.overdueDsars > 0 || s.activeBreaches > 0;

  return (
    <Card className={hasIssues ? "border-destructive/40" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
          <div className="flex items-center gap-2">
            <Shield className={`h-4 w-4 ${hasIssues ? "text-destructive" : "text-green-600"}`} />
            Compliance
          </div>
          {hasIssues && (
            <Badge variant="destructive" className="text-[10px]">
              Action required
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            CNDP
          </span>
          <Badge
            variant={
              s.cndpStatus === "approved"
                ? "success"
                : s.cndpStatus === "pending" || s.cndpStatus === "submitted"
                  ? "warning"
                  : "outline"
            }
            className="text-[10px]"
          >
            {s.cndpStatus ?? "Not filed"}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Open DSARs
          </span>
          <span className={`font-medium ${s.overdueDsars > 0 ? "text-destructive" : ""}`}>
            {s.openDsars}
            {s.overdueDsars > 0 && (
              <span className="ml-1 text-[10px] text-destructive">({s.overdueDsars} overdue)</span>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Active breaches
          </span>
          <span className={`font-medium ${s.activeBreaches > 0 ? "text-destructive" : ""}`}>
            {s.activeBreaches === 0 ? (
              <span className="text-green-600">None</span>
            ) : (
              s.activeBreaches
            )}
          </span>
        </div>

        {hasIssues && (
          <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2">
            <div className="flex items-center gap-2 text-[11px] text-destructive">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>
                {s.overdueDsars > 0 && `${s.overdueDsars} DSAR(s) overdue. `}
                {s.activeBreaches > 0 && `${s.activeBreaches} breach(es) unresolved.`}
              </span>
            </div>
          </div>
        )}

        <Link
          href="/super-admin/compliance"
          className="block text-center text-xs text-primary underline-offset-4 hover:underline"
        >
          View compliance center
        </Link>
      </CardContent>
    </Card>
  );
}
