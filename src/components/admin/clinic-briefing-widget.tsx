"use client";

/**
 * ClinicBriefingWidget — Super admin dashboard widget for AI-generated
 * daily clinic executive briefings.
 */

import {
  BrainCircuit,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──

interface Briefing {
  id: string;
  clinic_id: string;
  briefing_date: string;
  content: string;
  overall_sentiment: "positive" | "neutral" | "concerning" | "critical" | null;
  ai_model: string | null;
  generated_at: string;
  clinics?: { name: string } | null;
}

interface Props {
  className?: string;
}

// ── Sentiment config ──

const SENTIMENT_CONFIG = {
  positive: {
    label: "Positif",
    badgeClass: "bg-green-100 text-green-800 border-green-300",
    icon: TrendingUp,
    iconClass: "text-green-600",
  },
  neutral: {
    label: "Neutre",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
    icon: Minus,
    iconClass: "text-gray-500",
  },
  concerning: {
    label: "Préoccupant",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    icon: TrendingDown,
    iconClass: "text-amber-600",
  },
  critical: {
    label: "Critique",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
    icon: TrendingDown,
    iconClass: "text-red-600",
  },
} as const;

// ── Sub-components ──

function BriefingCard({ briefing }: { briefing: Briefing }) {
  const [expanded, setExpanded] = useState(false);
  const TRUNCATE_LENGTH = 200;

  const sentiment = briefing.overall_sentiment;
  const sentimentConfig = sentiment ? SENTIMENT_CONFIG[sentiment] : null;
  const SentimentIcon = sentimentConfig?.icon ?? Minus;

  const clinicName = briefing.clinics?.name ?? "Clinique";
  const dateStr = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(briefing.briefing_date));

  const isLong = briefing.content.length > TRUNCATE_LENGTH;
  const displayContent =
    !expanded && isLong ? `${briefing.content.slice(0, TRUNCATE_LENGTH)}…` : briefing.content;

  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{clinicName}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{dateStr}</span>
          </div>
        </div>
        {sentimentConfig && (
          <Badge className={`shrink-0 text-xs ${sentimentConfig.badgeClass}`}>
            <SentimentIcon className={`me-1 h-3 w-3 ${sentimentConfig.iconClass}`} />
            {sentimentConfig.label}
          </Badge>
        )}
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{displayContent}</p>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Réduire
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Voir tout
            </>
          )}
        </button>
      )}

      {briefing.ai_model && (
        <p className="mt-2 text-xs text-muted-foreground/60">Modèle: {briefing.ai_model}</p>
      )}
    </div>
  );
}

// ── Filter buttons ──

type DateFilter = "today" | "week";

// ── Main Component ──

export function ClinicBriefingWidget({ className }: Props) {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const fetchBriefings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Casablanca",
      }).format(new Date());

      // OWASP A03: URL params built safely — no user input in date
      const params = new URLSearchParams({ limit: "20" });
      if (dateFilter === "today") {
        params.set("date", today);
      }

      const response = await fetch(`/api/super-admin/ai-briefings?${params.toString()}`);
      const result = (await response.json()) as {
        ok: boolean;
        data?: { briefings: Briefing[]; count: number };
        error?: string;
      };

      if (!result.ok) {
        setError(result.error ?? "Erreur lors du chargement des briefings.");
        return;
      }

      setBriefings(result.data?.briefings ?? []);
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        void fetchBriefings();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [fetchBriefings]);

  const sentimentCounts = briefings.reduce(
    (acc, b) => {
      if (b.overall_sentiment) acc[b.overall_sentiment] = (acc[b.overall_sentiment] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainCircuit className="h-5 w-5 text-primary" />
            Briefings IA Cliniques
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Date filter */}
            <div className="flex rounded-md border text-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setDateFilter("today")}
                className={`px-2 py-1 transition-colors ${
                  dateFilter === "today" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("week")}
                className={`px-2 py-1 transition-colors ${
                  dateFilter === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                Cette semaine
              </button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={fetchBriefings}
              disabled={isLoading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Sentiment summary */}
        {!isLoading && briefings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(sentimentCounts).map(([sentiment, count]) => {
              const config = SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG];
              if (!config) return null;
              return (
                <Badge key={sentiment} className={`text-xs ${config.badgeClass}`}>
                  {count} {config.label.toLowerCase()}
                </Badge>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : briefings.length === 0 ? (
          <div className="rounded-md bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <BrainCircuit className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p>
              Aucun briefing IA généré {dateFilter === "today" ? "aujourd'hui" : "cette semaine"}.
            </p>
            <p className="mt-1 text-xs">Le cron s&apos;exécute à 06h00 (heure Maroc).</p>
          </div>
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto pe-1">
            {briefings.map((briefing) => (
              <BriefingCard key={briefing.id} briefing={briefing} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
