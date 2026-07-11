"use client";

/**
 * Super Admin Per-Clinic Usage Detail Page
 * TASK-07 from oltigo-usage-subscriptions-tasks.md
 *
 * Drill-down view showing a single clinic's 30-day usage snapshot history,
 * subscription history, and current quota status.
 *
 * URL: /super-admin/usage/clinic?id={clinicId}
 */

import {
  BarChart3,
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";

// ── Types ──

interface UsageSnapshot {
  snapshot_date: string;
  appointments_count: number;
  whatsapp_sent: number;
  ai_calls: number;
  storage_bytes: number;
  active_doctors: number;
}

interface SubscriptionHistoryEntry {
  id: string;
  event_type: string;
  from_plan_slug: string | null;
  to_plan_slug: string;
  amount_centimes: number;
  currency: string;
  notes: string | null;
  created_at: string;
}

interface ClinicDetail {
  id: string;
  name: string;
  tier: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  trial_started: "Essai démarré",
  trial_expired: "Essai expiré",
  plan_upgraded: "Plan amélioré",
  plan_downgraded: "Plan réduit",
  plan_cancelled: "Abonnement annulé",
  plan_reactivated: "Abonnement réactivé",
  payment_succeeded: "Paiement réussi",
  payment_failed: "Paiement échoué",
  billing_cycle_renewed: "Cycle renouvelé",
};

const EVENT_VARIANTS: Record<
  string,
  "default" | "success" | "destructive" | "warning" | "secondary"
> = {
  trial_started: "default",
  trial_expired: "warning",
  plan_upgraded: "success",
  plan_downgraded: "warning",
  plan_cancelled: "destructive",
  plan_reactivated: "success",
  payment_succeeded: "success",
  payment_failed: "destructive",
  billing_cycle_renewed: "secondary",
};

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function TrendIcon({ current, previous }: { current: number; previous: number }) {
  if (current > previous * 1.1) return <TrendingUp className="h-3 w-3 text-red-500" />;
  if (current < previous * 0.9) return <TrendingDown className="h-3 w-3 text-green-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export default function ClinicUsageDetailPage() {
  const searchParams = useSearchParams();
  const clinicId = searchParams.get("id");

  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([]);
  const [history, setHistory] = useState<SubscriptionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) {
      setError("Aucun ID de clinique fourni.");
      setLoading(false);
      return;
    }

    try {
      const [snapshotsRes, historyRes] = await Promise.all([
        fetch(`/api/super-admin/clinic-usage-detail?clinicId=${encodeURIComponent(clinicId)}`),
        fetch(`/api/super-admin/subscription-history?clinicId=${encodeURIComponent(clinicId)}`),
      ]);

      const snapshotsJson = (await snapshotsRes.json()) as {
        ok: boolean;
        data?: { clinic: ClinicDetail; snapshots: UsageSnapshot[] };
        error?: string;
      };

      if (!snapshotsJson.ok) {
        setError(snapshotsJson.error ?? "Erreur lors du chargement.");
        return;
      }

      setClinic(snapshotsJson.data?.clinic ?? null);
      setSnapshots(snapshotsJson.data?.snapshots ?? []);

      if (historyRes.ok) {
        const historyJson = (await historyRes.json()) as {
          ok: boolean;
          data?: { history: SubscriptionHistoryEntry[] };
        };
        if (historyJson.ok) setHistory(historyJson.data?.history ?? []);
      }
    } catch (err) {
      logger.warn("Failed to load clinic usage detail", { context: "page", error: err });
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        void load();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [load]);

  const TIER_LABELS: Record<string, string> = {
    free: "Gratuit",
    starter: "Starter",
    professional: "Professionnel",
    enterprise: "Entreprise",
  };

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Tableau de bord", href: "/super-admin/dashboard" },
          { label: "Utilisation", href: "/super-admin/usage" },
          { label: clinic?.name ?? "Clinique" },
        ]}
      />

      <div className="flex items-center gap-3">
        <Link
          href="/super-admin/usage"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{clinic?.name ?? "Détail d'utilisation"}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            30 derniers jours
            {clinic && (
              <Badge variant="outline" className="ml-2">
                Plan {TIER_LABELS[clinic.tier] ?? clinic.tier}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Trial info banner */}
          {clinic?.trial_ends_at && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="flex items-center gap-3 py-3 text-sm text-amber-800">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  Essai{" "}
                  {new Date(clinic.trial_ends_at) > new Date() ? "actif jusqu'au" : "expiré le"}{" "}
                  <strong>{new Date(clinic.trial_ends_at).toLocaleDateString("fr-FR")}</strong>
                </span>
              </CardContent>
            </Card>
          )}

          {/* Snapshot table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique d&apos;utilisation (30j)</CardTitle>
            </CardHeader>
            <CardContent>
              {snapshots.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun snapshot disponible. Le cron génère des snapshots quotidiennement.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Date</th>
                        <th className="pb-2 pr-4 font-medium">RDV</th>
                        <th className="pb-2 pr-4 font-medium">WhatsApp</th>
                        <th className="pb-2 pr-4 font-medium">IA</th>
                        <th className="pb-2 pr-4 font-medium">Stockage</th>
                        <th className="pb-2 font-medium">Médecins actifs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.map((snap, idx) => {
                        const prev = snapshots[idx + 1];
                        return (
                          <tr key={snap.snapshot_date} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">
                              {new Date(snap.snapshot_date).toLocaleDateString("fr-FR")}
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-1">
                                {snap.appointments_count}
                                {prev && (
                                  <TrendIcon
                                    current={snap.appointments_count}
                                    previous={prev.appointments_count}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="py-2 pr-4">{snap.whatsapp_sent}</td>
                            <td className="py-2 pr-4">{snap.ai_calls}</td>
                            <td className="py-2 pr-4">{formatStorage(snap.storage_bytes)}</td>
                            <td className="py-2">{snap.active_doctors}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique d&apos;abonnement</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun historique d&apos;abonnement.
                </p>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-4 rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={EVENT_VARIANTS[entry.event_type] ?? "default"}
                            className="text-xs"
                          >
                            {EVENT_LABELS[entry.event_type] ?? entry.event_type}
                          </Badge>
                          {entry.from_plan_slug && (
                            <span className="text-xs text-muted-foreground">
                              {entry.from_plan_slug} → {entry.to_plan_slug}
                            </span>
                          )}
                        </div>
                        {entry.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {entry.amount_centimes > 0 && (
                          <p className="text-sm font-medium">
                            {formatCurrency(entry.amount_centimes / 100, "fr", entry.currency)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
