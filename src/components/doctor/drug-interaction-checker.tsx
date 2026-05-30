"use client";

import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Info,
  Plus,
  X,
  Loader2,
  Pill,
} from "lucide-react";
import { useState, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
}

interface Interaction {
  drugs: string[];
  severity: "high" | "moderate" | "low";
  description: string;
  recommendation: string;
}

interface Warning {
  drug: string;
  type: "allergy" | "contraindication" | "dosage" | "renal" | "hepatic";
  message: string;
}

interface CheckResult {
  interactions: Interaction[];
  warnings: Warning[];
  summary: string;
}

const SEVERITY_CONFIG = {
  high: {
    icon: ShieldAlert,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "destructive" as const,
    label: { fr: "Élevé", ar: "مرتفع" },
  },
  moderate: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "outline" as const,
    label: { fr: "Modéré", ar: "متوسط" },
  },
  low: {
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    badge: "secondary" as const,
    label: { fr: "Faible", ar: "منخفض" },
  },
};

export function DrugInteractionChecker() {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  const [medications, setMedications] = useState<Medication[]>([
    { name: "", dosage: "", frequency: "" },
  ]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMedication = useCallback(() => {
    setMedications((prev) => [...prev, { name: "", dosage: "", frequency: "" }]);
  }, []);

  const removeMedication = useCallback((index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateMedication = useCallback((index: number, field: keyof Medication, value: string) => {
    setMedications((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }, []);

  const checkInteractions = useCallback(async () => {
    const validMeds = medications.filter((m) => m.name.trim().length > 0);
    if (validMeds.length < 2) {
      setError(
        lang === "ar"
          ? "أدخل دواءين على الأقل للتحقق"
          : "Entrez au moins 2 médicaments pour vérifier",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/drug-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medications: validMeds,
          language: lang,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setResult(json.data.result as CheckResult);
      } else {
        setError(json.error ?? "Erreur lors de la vérification");
      }
    } catch {
      setError(lang === "ar" ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [medications, lang]);

  const hasHighSeverity = result?.interactions.some((i) => i.severity === "high");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pill className="h-5 w-5" />
            {lang === "ar"
              ? "فحص التفاعلات الدوائية"
              : "Vérification des interactions médicamenteuses"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {medications.map((med, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder={lang === "ar" ? "اسم الدواء" : "Nom du médicament"}
                value={med.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateMedication(index, "name", e.target.value)
                }
                className="flex-1"
              />
              <Input
                placeholder={lang === "ar" ? "الجرعة" : "Dosage"}
                value={med.dosage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateMedication(index, "dosage", e.target.value)
                }
                className="w-28"
              />
              <Input
                placeholder={lang === "ar" ? "التكرار" : "Fréquence"}
                value={med.frequency}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateMedication(index, "frequency", e.target.value)
                }
                className="w-32"
              />
              {medications.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMedication(index)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addMedication}>
              <Plus className="mr-1 h-4 w-4" />
              {lang === "ar" ? "إضافة دواء" : "Ajouter un médicament"}
            </Button>
            <Button
              size="sm"
              onClick={() => void checkInteractions()}
              disabled={loading || medications.filter((m) => m.name.trim()).length < 2}
            >
              {loading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1 h-4 w-4" />
              )}
              {lang === "ar" ? "تحقق" : "Vérifier les interactions"}
            </Button>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Summary */}
          <Card className={hasHighSeverity ? "border-red-300 bg-red-50/50" : ""}>
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                {hasHighSeverity ? (
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                )}
                <p className="text-sm">{result.summary}</p>
              </div>
            </CardContent>
          </Card>

          {/* Interactions */}
          {result.interactions.length > 0 && (
            <div className="space-y-2">
              {result.interactions.map((interaction, i) => {
                const config = SEVERITY_CONFIG[interaction.severity];
                const Icon = config.icon;
                return (
                  <Card key={i} className={`${config.bg} border`}>
                    <CardContent className="py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${config.color}`} />
                          <span className="text-sm font-medium">
                            {interaction.drugs.join(" + ")}
                          </span>
                        </div>
                        <Badge variant={config.badge}>{config.label[lang]}</Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">{interaction.description}</p>
                      <p className="mt-1 text-sm font-medium">{interaction.recommendation}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {lang === "ar" ? "تحذيرات" : "Avertissements"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <span className="font-medium">{warning.drug}:</span> {warning.message}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {result.interactions.length === 0 && result.warnings.length === 0 && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="flex items-center gap-2 py-3">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <p className="text-sm">
                  {lang === "ar"
                    ? "لم يتم اكتشاف أي تفاعل دوائي"
                    : "Aucune interaction médicamenteuse détectée"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
