"use client";
/* eslint-disable i18next/no-literal-string */

/**
 * UsageWidget — Clinic admin dashboard widget showing monthly resource usage
 * against plan limits with visual progress bars.
 *
 * TASK-17 from oltigo-usage-subscriptions-tasks.md
 */

import { BarChart3, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types ──

interface UsageMetric {
  label: string;
  resourceType: string;
  current: number;
  limit: number;
  unit: string;
  formatValue: (v: number) => string;
}

interface QuotaResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remainingUnits: number;
  plan: string;
}

interface UsageData {
  plan: string;
  whatsapp: QuotaResult;
  sms: QuotaResult;
  ai_tokens: QuotaResult;
  r2_storage: QuotaResult;
}

// ── Helpers ──

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatLimit(v: number, unit: string): string {
  if (v === -1) return "∞";
  if (unit === "storage") return formatStorage(v);
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return v.toString();
}

// ── UsageMeter sub-component ──

function UsageMeter({ metric }: { metric: UsageMetric }) {
  const isUnlimited = metric.limit === -1 || metric.limit === 0;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((metric.current / metric.limit) * 100));

  const color =
    pct >= 100
      ? "bg-red-500"
      : pct >= 80
        ? "bg-amber-500"
        : "bg-[var(--oltigo-green,theme(colors.green.500))]";

  const textColor = pct >= 100 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-muted-foreground";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{metric.label}</span>
        <span className={`text-xs ${textColor}`}>
          {metric.formatValue(metric.current)} / {formatLimit(metric.limit, metric.unit)}
          {!isUnlimited && ` (${pct}%)`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className={`h-1.5 rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div className="h-1.5 w-full rounded-full bg-[var(--oltigo-green,theme(colors.green.400))] opacity-40" />
        </div>
      )}
    </div>
  );
}

// ── Main Widget ──

export function UsageWidget() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/clinic/quota-status");
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { ok: boolean; data: UsageData };
      if (json.ok) setUsage(json.data);
      else throw new Error("API error");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasOverage =
    usage &&
    [usage.whatsapp, usage.sms, usage.ai_tokens].some(
      (q) => q.limit > 0 && q.currentUsage >= q.limit,
    );

  const hasWarning =
    !hasOverage &&
    usage &&
    [usage.whatsapp, usage.sms, usage.ai_tokens].some(
      (q) => q.limit > 0 && q.currentUsage / q.limit >= 0.8,
    );

  const PLAN_LABELS: Record<string, string> = {
    free: "Gratuit",
    starter: "Starter",
    professional: "Professionnel",
    enterprise: "Entreprise",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" />
            Utilisation ce mois
          </CardTitle>
          <div className="flex items-center gap-2">
            {usage && (
              <Badge variant="outline" className="text-xs">
                Plan {PLAN_LABELS[usage.plan] ?? usage.plan}
              </Badge>
            )}
            {hasOverage && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Limite atteinte
              </Badge>
            )}
            {hasWarning && (
              <Badge variant="warning" className="text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" />
                80% utilisé
              </Badge>
            )}
            {!hasOverage && !hasWarning && usage && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-center text-sm text-muted-foreground">
            Impossible de charger l&apos;utilisation.
          </p>
        ) : usage ? (
          <>
            <UsageMeter
              metric={{
                label: "WhatsApp",
                resourceType: "whatsapp",
                current: usage.whatsapp.currentUsage,
                limit: usage.whatsapp.limit,
                unit: "messages",
                formatValue: (v) => v.toLocaleString("fr-MA"),
              }}
            />
            <UsageMeter
              metric={{
                label: "SMS",
                resourceType: "sms",
                current: usage.sms.currentUsage,
                limit: usage.sms.limit,
                unit: "messages",
                formatValue: (v) => v.toLocaleString("fr-MA"),
              }}
            />
            <UsageMeter
              metric={{
                label: "Appels IA",
                resourceType: "ai_tokens",
                current: usage.ai_tokens.currentUsage,
                limit: usage.ai_tokens.limit,
                unit: "tokens",
                formatValue: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()),
              }}
            />
            <UsageMeter
              metric={{
                label: "Stockage",
                resourceType: "r2_storage",
                current: usage.r2_storage.currentUsage,
                limit: usage.r2_storage.limit,
                unit: "storage",
                formatValue: (v) => formatStorage(v),
              }}
            />

            {(hasOverage || hasWarning) && (
              <Button asChild size="sm" className="w-full" variant={hasOverage ? "destructive" : "outline"}>
                <Link href="/admin/billing">
                  {hasOverage ? "Mettre à niveau — limite atteinte" : "Voir les options d'upgrade"}
                </Link>
              </Button>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
