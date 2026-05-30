"use client";

import { FileText, Loader2, Copy, Check, Printer } from "lucide-react";
import { useState, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface GenerationResult {
  letter: string;
  summary: string;
}

const SPECIALIST_OPTIONS = [
  "Cardiologue",
  "Dermatologue",
  "Gastro-entérologue",
  "Gynécologue",
  "Neurologue",
  "Ophtalmologue",
  "ORL",
  "Orthopédiste",
  "Pneumologue",
  "Rhumatologue",
  "Urologue",
  "Endocrinologue",
  "Psychiatre",
  "Chirurgien",
];

export function ReferralLetterGenerator() {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  const [specialistType, setSpecialistType] = useState("");
  const [reason, setReason] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [relevantHistory, setRelevantHistory] = useState("");
  const [relevantResults, setRelevantResults] = useState("");
  const [currentMedications, setCurrentMedications] = useState("");
  const [urgency, setUrgency] = useState("routine");

  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    if (!specialistType.trim() || !reason.trim() || !patientName.trim()) {
      setError(
        lang === "ar" ? "يرجى ملء الحقول المطلوبة" : "Veuillez remplir les champs obligatoires",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/referral-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialistType: specialistType.trim(),
          reason: reason.trim(),
          patientName: patientName.trim(),
          patientAge: patientAge ? Number(patientAge) : undefined,
          patientSex: patientSex || undefined,
          relevantHistory: relevantHistory || undefined,
          relevantResults: relevantResults || undefined,
          currentMedications: currentMedications || undefined,
          urgency,
          language: lang,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setResult({ letter: json.data.letter, summary: json.data.summary });
      } else {
        setError(json.error ?? "Erreur lors de la génération");
      }
    } catch {
      setError(lang === "ar" ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [
    specialistType,
    reason,
    patientName,
    patientAge,
    patientSex,
    relevantHistory,
    relevantResults,
    currentMedications,
    urgency,
    lang,
  ]);

  const copyToClipboard = useCallback(async () => {
    if (!result?.letter) return;
    await navigator.clipboard.writeText(result.letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const printLetter = useCallback(() => {
    if (!result?.letter) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>Lettre de référence</title>
        <style>body{font-family:serif;padding:40px;line-height:1.6;white-space:pre-wrap;}</style>
        </head><body>${result.letter.replace(/\n/g, "<br>")}</body></html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            {lang === "ar" ? "إنشاء خطاب إحالة" : "Générateur de lettre de référence"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Specialist type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                {lang === "ar" ? "نوع الأخصائي *" : "Spécialiste *"}
              </label>
              <select
                value={specialistType}
                onChange={(e) => setSpecialistType(e.target.value)}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
              >
                <option value="">{lang === "ar" ? "اختر..." : "Choisir..."}</option>
                {SPECIALIST_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                {lang === "ar" ? "درجة الاستعجال" : "Urgence"}
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
              >
                <option value="routine">{lang === "ar" ? "روتين" : "Routine"}</option>
                <option value="urgent">{lang === "ar" ? "عاجل" : "Urgent"}</option>
                <option value="emergency">{lang === "ar" ? "طارئ" : "Urgence"}</option>
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">
              {lang === "ar" ? "سبب الإحالة *" : "Motif de la référence *"}
            </label>
            <Input
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
              placeholder={
                lang === "ar"
                  ? "مثال: ألم في الصدر مع ضيق التنفس"
                  : "Ex: douleur thoracique avec dyspnée"
              }
            />
          </div>

          {/* Patient info */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                {lang === "ar" ? "اسم المريض *" : "Nom du patient *"}
              </label>
              <Input
                value={patientName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPatientName(e.target.value)
                }
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                {lang === "ar" ? "العمر" : "Âge"}
              </label>
              <Input
                type="number"
                value={patientAge}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientAge(e.target.value)}
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">
                {lang === "ar" ? "الجنس" : "Sexe"}
              </label>
              <select
                value={patientSex}
                onChange={(e) => setPatientSex(e.target.value)}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
              >
                <option value="">—</option>
                <option value="M">{lang === "ar" ? "ذكر" : "Masculin"}</option>
                <option value="F">{lang === "ar" ? "أنثى" : "Féminin"}</option>
              </select>
            </div>
          </div>

          {/* Optional fields */}
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">
              {lang === "ar" ? "السوابق المرضية" : "Antécédents pertinents"}
            </label>
            <Input
              value={relevantHistory}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setRelevantHistory(e.target.value)
              }
              placeholder={lang === "ar" ? "اختياري" : "Optionnel"}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">
              {lang === "ar" ? "نتائج الفحوصات" : "Résultats pertinents"}
            </label>
            <Input
              value={relevantResults}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setRelevantResults(e.target.value)
              }
              placeholder={lang === "ar" ? "اختياري" : "Optionnel"}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">
              {lang === "ar" ? "العلاج الحالي" : "Traitement actuel"}
            </label>
            <Input
              value={currentMedications}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCurrentMedications(e.target.value)
              }
              placeholder={lang === "ar" ? "اختياري" : "Optionnel"}
            />
          </div>

          <Button
            onClick={() => void generate()}
            disabled={loading || !specialistType.trim() || !reason.trim() || !patientName.trim()}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {lang === "ar" ? "إنشاء الخطاب" : "Générer la lettre"}
          </Button>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>

      {/* Generated letter */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {lang === "ar" ? "الخطاب المُنشأ" : "Lettre générée"}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyToClipboard()}>
                  {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                  {copied
                    ? lang === "ar"
                      ? "تم النسخ"
                      : "Copié"
                    : lang === "ar"
                      ? "نسخ"
                      : "Copier"}
                </Button>
                <Button variant="outline" size="sm" onClick={printLetter}>
                  <Printer className="mr-1 h-4 w-4" />
                  {lang === "ar" ? "طباعة" : "Imprimer"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-4 text-sm leading-relaxed dark:bg-gray-900">
              {result.letter}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
