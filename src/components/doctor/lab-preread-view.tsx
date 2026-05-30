"use client";

import {
  ArrowDown,
  ArrowUp,
  FlaskConical,
  HelpCircle,
  Loader2,
  Plus,
  ShieldAlert,
  TrendingUp,
  X,
} from "lucide-react";
import { useState, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface LabResult {
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
}

interface Anomaly {
  testName: string;
  value: string;
  status: "high" | "low" | "critical";
  interpretation: string;
  clinicalSignificance: string;
}

interface AnalysisResult {
  anomalies: Anomaly[];
  trends: string[];
  suggestedQuestions: string[];
  summary: string;
  urgentFlags: string[];
}

const STATUS_CONFIG = {
  critical: {
    icon: ShieldAlert,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "destructive" as const,
  },
  high: {
    icon: ArrowUp,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "outline" as const,
  },
  low: {
    icon: ArrowDown,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    badge: "secondary" as const,
  },
};

export function LabPrereadView() {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  const [results, setResults] = useState<LabResult[]>([
    { testName: "", value: "", unit: "", referenceRange: "" },
  ]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addResult = useCallback(() => {
    setResults((prev) => [...prev, { testName: "", value: "", unit: "", referenceRange: "" }]);
  }, []);

  const removeResult = useCallback((index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateResult = useCallback((index: number, field: keyof LabResult, value: string) => {
    setResults((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }, []);

  const analyzeResults = useCallback(async () => {
    const validResults = results.filter(
      (r) => r.testName.trim().length > 0 && r.value.trim().length > 0,
    );
    if (validResults.length === 0) {
      setError(lang === "ar" ? "أدخل نتيجة واحدة على الأقل" : "Entrez au moins un résultat");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch("/api/ai/lab-preread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: validResults, language: lang }),
      });

      const json = await res.json();
      if (json.ok) {
        setAnalysis(json.data.result as AnalysisResult);
      } else {
        setError(json.error ?? "Erreur lors de l'analyse");
      }
    } catch {
      setError(lang === "ar" ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [results, lang]);

  return (
    <div className="space-y-4">
      {/* Input form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-5 w-5" />
            {lang === "ar" ? "تحليل النتائج المخبرية" : "Pré-lecture des résultats de laboratoire"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {results.map((result, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder={lang === "ar" ? "اسم التحليل" : "Nom du test"}
                value={result.testName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateResult(index, "testName", e.target.value)
                }
                className="flex-1"
              />
              <Input
                placeholder={lang === "ar" ? "القيمة" : "Valeur"}
                value={result.value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateResult(index, "value", e.target.value)
                }
                className="w-24"
              />
              <Input
                placeholder={lang === "ar" ? "الوحدة" : "Unité"}
                value={result.unit}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateResult(index, "unit", e.target.value)
                }
                className="w-20"
              />
              <Input
                placeholder={lang === "ar" ? "المرجع" : "Réf."}
                value={result.referenceRange}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateResult(index, "referenceRange", e.target.value)
                }
                className="w-28"
              />
              {results.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeResult(index)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addResult}>
              <Plus className="mr-1 h-4 w-4" />
              {lang === "ar" ? "إضافة تحليل" : "Ajouter un test"}
            </Button>
            <Button
              size="sm"
              onClick={() => void analyzeResults()}
              disabled={
                loading || results.filter((r) => r.testName.trim() && r.value.trim()).length === 0
              }
            >
              {loading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-1 h-4 w-4" />
              )}
              {lang === "ar" ? "تحليل" : "Analyser les résultats"}
            </Button>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>

      {/* Analysis results */}
      {analysis && (
        <div className="space-y-3">
          {/* Urgent flags */}
          {analysis.urgentFlags.length > 0 && (
            <Card className="border-red-300 bg-red-50/50">
              <CardContent className="py-3">
                {analysis.urgentFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <p className="text-sm font-medium text-red-800">{flag}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card>
            <CardContent className="py-3">
              <p className="text-sm">{analysis.summary}</p>
            </CardContent>
          </Card>

          {/* Anomalies */}
          {analysis.anomalies.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {lang === "ar" ? "القيم غير الطبيعية" : "Valeurs anormales"}
              </h3>
              {analysis.anomalies.map((anomaly, i) => {
                const config = STATUS_CONFIG[anomaly.status];
                const Icon = config.icon;
                return (
                  <Card key={i} className={`${config.bg} border`}>
                    <CardContent className="py-3">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${config.color}`} />
                          <span className="text-sm font-medium">{anomaly.testName}</span>
                          <span className="text-muted-foreground text-sm">{anomaly.value}</span>
                        </div>
                        <Badge variant={config.badge}>
                          {anomaly.status === "critical"
                            ? lang === "ar"
                              ? "حرج"
                              : "Critique"
                            : anomaly.status === "high"
                              ? lang === "ar"
                                ? "مرتفع"
                                : "Élevé"
                              : lang === "ar"
                                ? "منخفض"
                                : "Bas"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">{anomaly.interpretation}</p>
                      <p className="mt-1 text-sm">{anomaly.clinicalSignificance}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Trends */}
          {analysis.trends.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  {lang === "ar" ? "ملاحظات" : "Observations"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {analysis.trends.map((trend, i) => (
                    <li key={i} className="text-muted-foreground text-sm">
                      {trend}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Suggested questions */}
          {analysis.suggestedQuestions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <HelpCircle className="h-4 w-4" />
                  {lang === "ar" ? "أسئلة مقترحة للمريض" : "Questions suggérées pour le patient"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {analysis.suggestedQuestions.map((q, i) => (
                    <li key={i} className="text-sm">
                      {q}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
