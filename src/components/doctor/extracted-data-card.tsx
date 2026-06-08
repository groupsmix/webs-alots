"use client";

/**
 * ExtractedDataCard
 *
 * Displays AI-extracted structured data from a Moroccan medical document
 * (lab results, medications, diagnoses, critical findings, etc.).
 *
 * Designed to be polled alongside the extraction-status API route so the
 * UI updates automatically once the background edge function completes.
 */

import { AlertTriangle, CheckCircle, FlaskConical, Loader2, Pill, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LabResult {
  testName: string;
  value: string;
  unit: string;
  referenceRange?: string;
  flag?: "H" | "L" | "critical" | "normal";
  interpretation?: string;
}

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

interface ExtractedData {
  documentType: string;
  labResults?: LabResult[];
  medications?: Medication[];
  diagnoses?: string[];
  criticalFindings?: string[];
  summary?: string;
  date?: string;
}

interface Props {
  extractedData: ExtractedData | null;
  extractionStatus: "pending" | "processing" | "completed" | "failed";
  className?: string;
}

// ── Flag display config ───────────────────────────────────────────────────────

const FLAG_CONFIG: Record<NonNullable<LabResult["flag"]>, { label: string; className: string }> = {
  H: { label: "↑", className: "text-orange-600 font-bold" },
  L: { label: "↓", className: "text-blue-600 font-bold" },
  critical: { label: "⚠", className: "text-red-600 font-bold" },
  normal: { label: "✓", className: "text-green-600" },
};

// ── Document type labels ──────────────────────────────────────────────────────

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  lab_result: "Résultats de laboratoire",
  prescription: "Ordonnance",
  radiology: "Radiologie",
  discharge_summary: "Compte-rendu d'hospitalisation",
  other: "Autre",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm font-medium">Analyse IA en cours…</p>
      <p className="text-xs">Extraction des données du document médical</p>
    </div>
  );
}

function FailedState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-destructive">
      <AlertTriangle className="h-8 w-8" />
      <p className="text-sm font-medium">L&apos;extraction a échoué. Réessayez.</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
      <CheckCircle className="h-8 w-8" />
      <p className="text-sm">Aucune donnée extraite</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ExtractedDataCard({ extractedData, extractionStatus, className }: Props) {
  // ── Loading states ──
  if (extractionStatus === "pending" || extractionStatus === "processing") {
    return (
      <Card className={cn(className)}>
        <CardContent className="pt-6">
          <LoadingState />
        </CardContent>
      </Card>
    );
  }

  if (extractionStatus === "failed") {
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardContent className="pt-6">
          <FailedState />
        </CardContent>
      </Card>
    );
  }

  // completed but no data
  if (!extractedData) {
    return (
      <Card className={cn(className)}>
        <CardContent className="pt-6">
          <EmptyState />
        </CardContent>
      </Card>
    );
  }

  const {
    documentType,
    labResults = [],
    medications = [],
    diagnoses = [],
    criticalFindings = [],
    summary,
    date,
  } = extractedData;

  const docTypeLabel = DOCUMENT_TYPE_LABELS[documentType] ?? documentType ?? "Document médical";

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Données extraites par IA
          </span>
          {date && <span className="text-xs font-normal text-muted-foreground">{date}</span>}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Document type badge ── */}
        <div>
          <Badge variant="secondary" className="text-xs">
            {docTypeLabel}
          </Badge>
        </div>

        {/* ── Critical findings ── */}
        {criticalFindings.length > 0 && (
          <section aria-label="Résultats critiques">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Résultats critiques
            </h3>
            <div className="space-y-2">
              {criticalFindings.map((finding, i) => (
                <div
                  key={i}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {finding}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Summary ── */}
        {summary && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Résumé</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
          </section>
        )}

        {/* ── Lab results table ── */}
        {labResults.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <FlaskConical className="h-4 w-4 text-primary" />
              Résultats de laboratoire
            </h3>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Test</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Valeur
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Référence
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                      Flag
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {labResults.map((result, i) => {
                    const flagCfg = result.flag ? FLAG_CONFIG[result.flag] : null;
                    const rowBg =
                      result.flag === "critical"
                        ? "bg-red-50/50"
                        : result.flag === "H"
                          ? "bg-orange-50/50"
                          : result.flag === "L"
                            ? "bg-blue-50/50"
                            : "";

                    return (
                      <tr key={i} className={cn("transition-colors hover:bg-muted/30", rowBg)}>
                        <td className="px-3 py-2 font-medium">
                          {result.testName}
                          {result.interpretation && (
                            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                              {result.interpretation}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {result.value}
                          {result.unit && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {result.unit}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {result.referenceRange ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {flagCfg ? (
                            <span
                              className={flagCfg.className}
                              title={result.flag ?? ""}
                              aria-label={result.flag ?? ""}
                            >
                              {flagCfg.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Medications ── */}
        {medications.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Pill className="h-4 w-4 text-primary" />
              Médicaments
            </h3>
            <ul className="space-y-2">
              {medications.map((med, i) => (
                <li key={i} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-medium">{med.name}</span>
                  {(med.dosage ?? med.frequency ?? med.duration) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[med.dosage, med.frequency, med.duration].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Diagnoses ── */}
        {diagnoses.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Diagnostics</h3>
            <ul className="space-y-1">
              {diagnoses.map((diagnosis, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  {diagnosis}
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
