"use client";

/**
 * AI Suggestions Panel
 *
 * Floating panel displayed alongside the prescription form.
 * Shows real-time AI-powered suggestions (medications, lab tests,
 * follow-up timing) as the doctor types a diagnosis.
 *
 * Feature-gated via "ai_auto_suggest" flag — Professional+ plan.
 * Doctor always has final say — suggestions are optional.
 */

import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Brain,
  Pill,
  FlaskConical,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Loader2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  X,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useClinicFeatures } from "@/lib/hooks/use-clinic-features";

// ── Types ──

interface SuggestedMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface SuggestedLabTest {
  name: string;
  reason: string;
}

interface AutoSuggestResult {
  medications: SuggestedMedication[];
  labTests: SuggestedLabTest[];
  followUpDays: number | null;
  followUpReason: string;
  notes: string;
  warnings: string[];
}

interface AiSuggestionsPanelProps {
  /** Current diagnosis text typed by the doctor */
  diagnosis: string;
  /** Patient ID (optional — enriches suggestions with patient context) */
  patientId?: string;
  /** Patient context (optional) */
  patientContext?: {
    age?: number;
    gender?: "M" | "F";
    allergies?: string[];
    currentMedications?: string[];
    chronicConditions?: string[];
    weight?: number;
  };
  /** Callback when doctor accepts a medication suggestion */
  onAcceptMedication?: (med: SuggestedMedication) => void;
  /** Callback when doctor accepts all medication suggestions */
  onAcceptAllMedications?: (meds: SuggestedMedication[]) => void;
}

// ── Debounce hook ──

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ── Component ──

export function AiSuggestionsPanel({
  diagnosis,
  patientId,
  patientContext,
  onAcceptMedication,
  onAcceptAllMedications,
}: AiSuggestionsPanelProps) {
  const { hasFeature, loaded } = useClinicFeatures();
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AutoSuggestResult | null>(null);
  const [acceptedMeds, setAcceptedMeds] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // Debounce diagnosis input to avoid excessive API calls
  const debouncedDiagnosis = useDebouncedValue(diagnosis, 1500);

  const fetchSuggestions = useCallback(
    async (diag: string) => {
      if (!diag.trim() || diag.trim().length < 3) {
        setResult(null);
        setError(null);
        return;
      }

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setAcceptedMeds(new Set());

      try {
        const response = await fetch("/api/ai/auto-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diagnosis: diag.trim(),
            patientId,
            patientContext,
          }),
          signal: controller.signal,
        });

        const json = (await response.json()) as {
          ok: boolean;
          data?: { suggestions: AutoSuggestResult };
          error?: string;
        };

        if (!json.ok || !json.data) {
          setError(json.error ?? "Erreur lors de la génération des suggestions.");
          setResult(null);
          return;
        }

        setResult(json.data.suggestions);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Impossible de contacter le serveur. Veuillez réessayer.");
        setResult(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [patientId, patientContext],
  );

  // Fetch suggestions when debounced diagnosis changes
  useEffect(() => {
    void fetchSuggestions(debouncedDiagnosis);
  }, [debouncedDiagnosis, fetchSuggestions]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleAcceptMed = (index: number, med: SuggestedMedication) => {
    setAcceptedMeds((prev) => new Set(prev).add(index));
    onAcceptMedication?.(med);
  };

  const handleAcceptAll = () => {
    if (!result) return;
    const allIndexes = new Set(result.medications.map((_, i) => i));
    setAcceptedMeds(allIndexes);
    onAcceptAllMedications?.(result.medications);
  };

  // Don't render if feature is not enabled
  if (!loaded || !hasFeature("ai_auto_suggest")) {
    return null;
  }

  // Don't render if no diagnosis yet
  if (!diagnosis.trim() && !result && !loading) {
    return null;
  }

  return (
    <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/20 dark:bg-violet-900/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span>Suggestions IA</span>
            {loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {result && !loading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void fetchSuggestions(diagnosis)}
                className="h-7 text-xs"
                title="Actualiser"
              >
                Actualiser
              </Button>
            )}
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
          <ScrollArea className="max-h-[400px]">
            {/* Loading state */}
            {loading && !result && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                <span className="text-sm text-muted-foreground">
                  Analyse du diagnostic...
                </span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive py-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4">
                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        {result.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                            {w}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Medications */}
                {result.medications.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Pill className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                        <span className="text-xs font-medium">Médicaments suggérés</span>
                      </div>
                      {onAcceptAllMedications && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleAcceptAll}
                          className="h-6 text-[10px] text-violet-600 dark:text-violet-400"
                          disabled={acceptedMeds.size === result.medications.length}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Tout accepter
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {result.medications.map((med, i) => {
                        const isAccepted = acceptedMeds.has(i);
                        return (
                          <div
                            key={i}
                            className={`rounded-lg border p-2.5 text-xs transition-colors ${
                              isAccepted
                                ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10"
                                : "border-border hover:border-violet-300 dark:hover:border-violet-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-0.5">
                                <p className="font-medium">{med.name}</p>
                                <p className="text-muted-foreground">
                                  {med.dosage} — {med.frequency} — {med.duration}
                                </p>
                                {med.instructions && (
                                  <p className="text-muted-foreground italic">
                                    {med.instructions}
                                  </p>
                                )}
                              </div>
                              {onAcceptMedication && !isAccepted && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAcceptMed(i, med)}
                                  className="h-6 w-6 p-0 shrink-0 text-violet-600 dark:text-violet-400 hover:text-violet-700"
                                  title="Accepter"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isAccepted && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 shrink-0"
                                >
                                  Accepté
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lab tests */}
                {result.labTests.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <FlaskConical className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium">Examens recommandés</span>
                    </div>
                    <div className="space-y-1.5">
                      {result.labTests.map((test, i) => (
                        <div
                          key={i}
                          className="rounded-lg border p-2.5 text-xs"
                        >
                          <p className="font-medium">{test.name}</p>
                          <p className="text-muted-foreground">{test.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up */}
                {result.followUpDays !== null && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CalendarClock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-medium">Suivi recommandé</span>
                    </div>
                    <div className="rounded-lg border p-2.5 text-xs">
                      <p className="font-medium">
                        Dans {result.followUpDays} jour{result.followUpDays > 1 ? "s" : ""}
                      </p>
                      {result.followUpReason && (
                        <p className="text-muted-foreground">{result.followUpReason}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {result.notes && (
                  <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    <p>{result.notes}</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
