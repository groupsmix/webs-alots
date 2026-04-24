"use client";

/**
 * Drug Interaction Alert Component
 *
 * Displays drug-drug interaction and allergy conflict alerts with
 * severity-coded colors (Red/Yellow/Green). Supports override with
 * reason logging for medical-legal audit trail.
 *
 * Used in the prescription form — triggered on every medication add/change.
 */

import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { InteractionAlert } from "@/lib/check-interactions";

// ── Types ──

interface InteractionAlertPanelProps {
  /** List of interaction alerts to display */
  alerts: InteractionAlert[];
  /** Whether the check is currently running */
  loading?: boolean;
  /** Patient ID for audit logging */
  patientId?: string;
  /** Callback when an alert is overridden (acknowledged) */
  onOverride?: (alertId: string) => void;
  /** Overall severity */
  overallSeverity?: "dangerous" | "caution" | "safe";
}

interface OverrideDialogState {
  alertId: string;
  alertTitle: string;
  alertSeverity: "dangerous" | "caution";
  reason: string;
  medications: string[];
  submitting: boolean;
}

// ── Severity config ──

const SEVERITY_CONFIG = {
  dangerous: {
    icon: ShieldAlert,
    label: "Danger",
    bgClass: "bg-red-50 dark:bg-red-900/20",
    borderClass: "border-red-200 dark:border-red-800",
    textClass: "text-red-700 dark:text-red-400",
    badgeVariant: "destructive" as const,
  },
  caution: {
    icon: AlertTriangle,
    label: "Précaution",
    bgClass: "bg-yellow-50 dark:bg-yellow-900/20",
    borderClass: "border-yellow-200 dark:border-yellow-800",
    textClass: "text-yellow-700 dark:text-yellow-500",
    badgeVariant: "secondary" as const,
  },
  safe: {
    icon: ShieldCheck,
    label: "Sûr",
    bgClass: "bg-green-50 dark:bg-green-900/20",
    borderClass: "border-green-200 dark:border-green-800",
    textClass: "text-green-700 dark:text-green-400",
    badgeVariant: "outline" as const,
  },
} as const;

// ── Loading skeleton ──

function AlertSkeleton() {
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

// ── Single alert item ──

function AlertItem({
  alert,
  patientId,
  onOverride,
}: {
  alert: InteractionAlert;
  patientId?: string;
  onOverride?: (alertId: string) => void;
}) {
  const [expanded, setExpanded] = useState(alert.severity === "dangerous");
  const [overrideState, setOverrideState] = useState<OverrideDialogState | null>(null);
  const [overridden, setOverridden] = useState(false);

  const config = SEVERITY_CONFIG[alert.severity];
  const Icon = config.icon;

  const handleOverrideSubmit = useCallback(async () => {
    if (!overrideState || !overrideState.reason.trim()) return;

    setOverrideState((prev) => (prev ? { ...prev, submitting: true } : null));

    try {
      const res = await fetch("/api/v1/ai/drug-check", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          alertId: overrideState.alertId,
          alertSeverity: overrideState.alertSeverity,
          alertTitle: overrideState.alertTitle,
          reason: overrideState.reason,
          medications: overrideState.medications,
        }),
      });

      const json = (await res.json()) as { ok: boolean };
      if (json.ok) {
        setOverridden(true);
        setOverrideState(null);
        onOverride?.(alert.id);
      }
    } catch {
      // Silently fail — the alert stays visible
    } finally {
      setOverrideState((prev) => (prev ? { ...prev, submitting: false } : null));
    }
  }, [overrideState, patientId, alert.id, onOverride]);

  if (overridden) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-gray-400" />
        <span className="line-through">{alert.title}</span>
        <Badge variant="outline" className="text-[10px] ml-auto">
          Confirmé
        </Badge>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${config.borderClass} ${config.bgClass} overflow-hidden`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <Icon className={`h-4 w-4 shrink-0 ${config.textClass}`} />
        <span className={`text-sm font-medium flex-1 ${config.textClass}`}>
          {alert.title}
        </span>
        <Badge variant={config.badgeVariant} className="text-[10px] shrink-0">
          {alert.type === "allergy" ? "Allergie" : config.label}
        </Badge>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-inherit">
          <p className="text-xs leading-relaxed mt-2">{alert.description}</p>
          <div className="flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-xs font-medium">{alert.recommendation}</p>
          </div>

          {/* Override button (only for dangerous/caution) */}
          {alert.severity !== "safe" && !overrideState && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setOverrideState({
                    alertId: alert.id,
                    alertTitle: alert.title,
                    alertSeverity: alert.severity as "dangerous" | "caution",
                    reason: "",
                    medications: alert.drugs,
                    submitting: false,
                  });
                }}
              >
                Confirmer et continuer malgré l&apos;alerte
              </Button>
            </div>
          )}

          {/* Override reason form */}
          {overrideState && (
            <div className="pt-1 space-y-2 border-t border-inherit mt-2">
              <label className="block text-xs font-medium mt-2">
                Raison de la confirmation (obligatoire — enregistrée pour audit) :
              </label>
              <textarea
                className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 p-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Ex: Bénéfice thérapeutique supérieur au risque, surveillance renforcée prévue..."
                value={overrideState.reason}
                onChange={(e) =>
                  setOverrideState((prev) =>
                    prev ? { ...prev, reason: e.target.value } : null,
                  )
                }
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs h-7"
                  disabled={!overrideState.reason.trim() || overrideState.submitting}
                  onClick={handleOverrideSubmit}
                >
                  {overrideState.submitting ? "Enregistrement..." : "Confirmer la prescription"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setOverrideState(null)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ──

export function InteractionAlertPanel({
  alerts,
  loading = false,
  patientId,
  onOverride,
  overallSeverity = "safe",
}: InteractionAlertPanelProps) {
  // Don't render anything if safe and no alerts
  if (!loading && alerts.length === 0 && overallSeverity === "safe") {
    return null;
  }

  const dangerousCount = alerts.filter((a) => a.severity === "dangerous").length;
  const cautionCount = alerts.filter((a) => a.severity === "caution").length;

  // Overall severity config for the card border
  const cardConfig = overallSeverity !== "safe" ? SEVERITY_CONFIG[overallSeverity] : null;

  return (
    <Card
      className={
        cardConfig
          ? `${cardConfig.borderClass} ${cardConfig.bgClass}`
          : "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10"
      }
    >
      <CardContent className="p-3 space-y-2">
        {/* Header summary */}
        <div className="flex items-center gap-2">
          {overallSeverity === "dangerous" && (
            <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
          )}
          {overallSeverity === "caution" && (
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          )}
          {overallSeverity === "safe" && !loading && (
            <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
          <span className="text-sm font-medium">
            {loading
              ? "Vérification des interactions..."
              : overallSeverity === "safe"
                ? "Aucune interaction détectée"
                : `${dangerousCount > 0 ? `${dangerousCount} danger${dangerousCount > 1 ? "s" : ""}` : ""}${dangerousCount > 0 && cautionCount > 0 ? ", " : ""}${cautionCount > 0 ? `${cautionCount} précaution${cautionCount > 1 ? "s" : ""}` : ""}`}
          </span>
        </div>

        {/* Loading state */}
        {loading && <AlertSkeleton />}

        {/* Alert list */}
        {!loading && alerts.length > 0 && (
          <div className="space-y-1.5">
            {alerts.map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                patientId={patientId}
                onOverride={onOverride}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Hook: use drug interaction check ──

/**
 * React hook to check drug interactions.
 * Call `checkInteractions` whenever medications change.
 */
export function useDrugInteractionCheck(patientId?: string) {
  const [alerts, setAlerts] = useState<InteractionAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [overallSeverity, setOverallSeverity] = useState<"dangerous" | "caution" | "safe">("safe");

  const checkInteractions = useCallback(
    async (medications: string[], patientAllergies?: string[]) => {
      if (medications.length === 0) {
        setAlerts([]);
        setOverallSeverity("safe");
        return;
      }

      setLoading(true);

      try {
        const res = await fetch("/api/v1/ai/drug-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medications,
            patientId,
            patientAllergies,
            useAiFallback: medications.length > 1,
          }),
        });

        const json = (await res.json()) as {
          ok: boolean;
          data?: {
            overallSeverity: "dangerous" | "caution" | "safe";
            alerts: InteractionAlert[];
          };
        };

        if (json.ok && json.data) {
          setAlerts(json.data.alerts);
          setOverallSeverity(json.data.overallSeverity);
        }
      } catch {
        // Silently fail — don't block prescription
      } finally {
        setLoading(false);
      }
    },
    [patientId],
  );

  const handleOverride = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  return {
    alerts,
    loading,
    overallSeverity,
    checkInteractions,
    handleOverride,
  };
}
