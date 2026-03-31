"use client";

/**
 * AI Patient Summary Card
 *
 * Collapsible card displayed at the top of a patient file.
 * Shows a 1-paragraph AI-generated summary of the patient's medical history,
 * alerts, and trends. Supports caching, loading skeleton, and refresh.
 */

import { useState, useEffect, useCallback } from "react";
import { Brain, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

// ── Types ──

interface AiSummaryResponse {
  summary: string;
  generatedAt: string;
  patientId: string;
  cached: boolean;
}

interface AiSummaryCardProps {
  patientId: string;
  /** Auto-fetch summary on mount (default: true) */
  autoFetch?: boolean;
}

// ── Loading Skeleton ──

function SummarySkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[95%]" />
      <Skeleton className="h-4 w-[85%]" />
      <Skeleton className="h-4 w-[70%]" />
    </div>
  );
}

// ── Component ──

export function AiSummaryCard({ patientId, autoFetch = true }: AiSummaryCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchSummary = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/v1/ai/patient-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId, forceRefresh }),
        });

        const json = (await res.json()) as {
          ok: boolean;
          data?: AiSummaryResponse;
          error?: string;
          code?: string;
        };

        if (!json.ok || !json.data) {
          setError(json.error ?? "Erreur lors de la génération du résumé.");
          return;
        }

        setSummary(json.data.summary);
        setGeneratedAt(json.data.generatedAt);
        setCached(json.data.cached);
      } catch {
        setError("Impossible de contacter le serveur. Veuillez réessayer.");
      } finally {
        setLoading(false);
      }
    },
    [patientId],
  );

  useEffect(() => {
    if (autoFetch && patientId) {
      void fetchSummary();
    }
  }, [autoFetch, patientId, fetchSummary]);

  const handleRefresh = () => {
    void fetchSummary(true);
  };

  const formattedDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Résumé IA du patient</span>
            {cached && (
              <Badge variant="outline" className="text-[10px] ml-1">
                En cache
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="h-7 w-7 p-0"
              title="Actualiser le résumé"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="h-7 w-7 p-0"
            >
              {isOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0">
          {loading && <SummarySkeleton />}

          {!loading && error && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && summary && (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed text-foreground">{summary}</p>
              {formattedDate && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Généré le {formattedDate}</span>
                </div>
              )}
            </div>
          )}

          {!loading && !error && !summary && !autoFetch && (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground mb-2">
                Cliquez pour générer un résumé IA du dossier patient.
              </p>
              <Button variant="outline" size="sm" onClick={() => fetchSummary()}>
                <Brain className="h-3.5 w-3.5 mr-1.5" />
                Générer le résumé
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
