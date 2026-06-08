"use client";
/* eslint-disable i18next/no-literal-string -- Doctor-facing clinical safety UI */

/**
 * PrescriptionSafetyBanner — displays AI-detected safety flags for a prescription.
 *
 * Shows flags grouped by severity (critical → major → moderate → minor) with
 * color-coded cards. Hidden when there are no flags or the check hasn't run.
 */

import {
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SafetyFlag, SafetyResult } from "@/lib/hooks/use-prescription-safety";

// ── Types ──

interface Props {
  result: SafetyResult | null;
  isChecking: boolean;
  error?: string | null;
  className?: string;
}

// ── Severity config ──

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    label: "DANGER — Contre-indication absolue",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
    cardClass: "border-red-400 bg-red-50",
    headerClass: "text-red-900",
    iconClass: "text-red-600",
  },
  major: {
    icon: AlertCircle,
    label: "ATTENTION — Interaction majeure",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
    cardClass: "border-orange-400 bg-orange-50",
    headerClass: "text-orange-900",
    iconClass: "text-orange-600",
  },
  moderate: {
    icon: Info,
    label: "Précaution — Interaction modérée",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    cardClass: "border-amber-400 bg-amber-50",
    headerClass: "text-amber-900",
    iconClass: "text-amber-600",
  },
  minor: {
    icon: Info,
    label: "Information — Interaction mineure",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    cardClass: "border-blue-300 bg-blue-50",
    headerClass: "text-blue-900",
    iconClass: "text-blue-500",
  },
} as const;

const RISK_BADGE_CONFIG: Record<SafetyResult["overallRisk"], { label: string; className: string }> =
  {
    safe: {
      label: "Aucun risque détecté",
      className: "bg-green-100 text-green-800 border-green-300",
    },
    caution: {
      label: "Précautions recommandées",
      className: "bg-amber-100 text-amber-800 border-amber-300",
    },
    warning: {
      label: "Avertissements détectés",
      className: "bg-orange-100 text-orange-800 border-orange-300",
    },
    danger: {
      label: "DANGER — Vérification requise",
      className: "bg-red-100 text-red-800 border-red-300",
    },
  };

const SEVERITY_ORDER: SafetyFlag["severity"][] = ["critical", "major", "moderate", "minor"];

// ── Sub-components ──

function FlagCard({ flag }: { flag: SafetyFlag }) {
  const [expanded, setExpanded] = useState(flag.severity === "critical");
  const config = SEVERITY_CONFIG[flag.severity];
  const Icon = config.icon;

  return (
    <div className={`rounded-md border p-3 ${config.cardClass}`}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${config.iconClass}`} />
          <span className={`text-sm font-semibold ${config.headerClass}`}>
            {flag.drugs.length > 0 ? flag.drugs.join(" + ") : config.label}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 opacity-60" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 text-sm">
          <p className={`${config.headerClass}`}>{flag.message}</p>
          {flag.recommendation && (
            <p className="font-medium text-gray-700">Recommandation: {flag.recommendation}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export function PrescriptionSafetyBanner({ result, isChecking, error, className }: Props) {
  // Loading state
  if (isChecking) {
    return (
      <div
        className={`flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 ${className ?? ""}`}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Vérification de sécurité médicamenteuse en cours…
      </div>
    );
  }

  // Error state (non-blocking)
  if (error) {
    return (
      <div
        className={`flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 ${className ?? ""}`}
      >
        <Info className="h-4 w-4 shrink-0" />
        Vérification de sécurité non disponible. Vérifiez manuellement les interactions.
      </div>
    );
  }

  // No result yet or empty (safe)
  if (!result) return null;

  // Safe — no flags
  if (result.flags.length === 0) {
    return (
      <div
        className={`flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 ${className ?? ""}`}
      >
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Aucune interaction ou contre-indication détectée.
      </div>
    );
  }

  const riskConfig = RISK_BADGE_CONFIG[result.overallRisk];

  // Group flags by severity
  const flagsBySeverity = SEVERITY_ORDER.reduce<Record<SafetyFlag["severity"], SafetyFlag[]>>(
    (acc, sev) => {
      acc[sev] = result.flags.filter((f) => f.severity === sev);
      return acc;
    },
    { critical: [], major: [], moderate: [], minor: [] },
  );

  return (
    <Card
      className={`border-2 ${result.overallRisk === "danger" ? "border-red-400" : result.overallRisk === "warning" ? "border-orange-400" : "border-amber-300"} ${className ?? ""}`}
    >
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Analyse de sécurité médicamenteuse IA
          </div>
          <Badge className={`text-xs ${riskConfig.className}`}>{riskConfig.label}</Badge>
        </CardTitle>
        {result.summary && <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>}
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        {SEVERITY_ORDER.map((severity) => {
          const flags = flagsBySeverity[severity];
          if (flags.length === 0) return null;
          return (
            <div key={severity} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${SEVERITY_CONFIG[severity].badgeClass}`}>
                  {SEVERITY_CONFIG[severity].label}
                </Badge>
                <span className="text-xs text-muted-foreground">({flags.length})</span>
              </div>
              {flags.map((flag, idx) => (
                <FlagCard key={`${severity}-${idx}`} flag={flag} />
              ))}
            </div>
          );
        })}

        {result.disclaimer && <p className="mt-2 text-xs text-gray-400">{result.disclaimer}</p>}
      </CardContent>
    </Card>
  );
}
