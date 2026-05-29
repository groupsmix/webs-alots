"use client";

import {
  Pill,
  AlertTriangle,
  Loader2,
  Save,
  Printer,
  Plus,
  Trash2,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Medication {
  name: string;
  dci: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  form: string;
}

interface DrugInteraction {
  drug: string;
  severity: "dangerous" | "caution" | "safe";
  description: string;
}

interface SmartPrescriptionResult {
  medication: Medication;
  interactions: DrugInteraction[];
  contraindications: string[];
  warnings: string[];
  alternatives: string[];
}

interface PrescriptionMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export default function SmartPrescriptionPage() {
  const [patientId, setPatientId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [drugSearch, setDrugSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiResult, setAiResult] = useState<SmartPrescriptionResult | null>(null);
  const [medications, setMedications] = useState<PrescriptionMedication[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [interactionAlerts, setInteractionAlerts] = useState<
    Array<{ drugs: string[]; severity: string; title: string; description: string }>
  >([]);
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);

  const searchDrug = useCallback(async () => {
    if (!drugSearch.trim() || !patientId.trim() || !diagnosis.trim()) {
      setError("Veuillez remplir l'ID patient, le diagnostic et le nom du médicament.");
      return;
    }

    setIsSearching(true);
    setError(null);
    setAiResult(null);

    try {
      const response = await fetch("/api/v1/ai/smart-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          diagnosis,
          symptoms: symptoms || undefined,
          drugName: drugSearch,
        }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        data?: SmartPrescriptionResult & { disclaimer: string };
        error?: string;
      };

      if (!result.ok) {
        setError(result.error ?? "Erreur lors de la recherche.");
        return;
      }

      if (result.data) {
        setAiResult(result.data);
        setDisclaimer(result.data.disclaimer);
        if (result.data.warnings.length > 0) {
          setWarnings((prev) => [...new Set([...prev, ...result.data!.warnings])]);
        }
      }
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setIsSearching(false);
    }
  }, [drugSearch, patientId, diagnosis, symptoms]);

  const checkInteractions = useCallback(
    async (medNames: string[]) => {
      if (medNames.length < 2 || !patientId) return;

      setIsCheckingInteractions(true);

      try {
        const response = await fetch("/api/v1/ai/drug-interaction-alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medications: medNames,
            patientId,
          }),
        });

        const result = (await response.json()) as {
          ok: boolean;
          data?: {
            alerts: Array<{
              drugs: string[];
              severity: string;
              title: string;
              description: string;
            }>;
          };
        };

        if (result.ok && result.data?.alerts) {
          setInteractionAlerts(result.data.alerts);
        }
      } catch {
        // Non-blocking — interaction check failure should not block prescription
      } finally {
        setIsCheckingInteractions(false);
      }
    },
    [patientId],
  );

  const addMedicationFromAI = useCallback(() => {
    if (!aiResult) return;

    const newMed: PrescriptionMedication = {
      name: aiResult.medication.dci || aiResult.medication.name,
      dosage: aiResult.medication.dosage,
      frequency: aiResult.medication.frequency,
      duration: aiResult.medication.duration,
      instructions: aiResult.medication.instructions,
    };

    setMedications((prev) => [...prev, newMed]);
    setDrugSearch("");
    setAiResult(null);

    // Check interactions with existing medications
    void checkInteractions([...medications.map((m) => m.name), newMed.name]);
  }, [aiResult, medications, checkInteractions]);

  const removeMedication = useCallback((index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const savePrescription = useCallback(
    async (status: "draft" | "signed") => {
      if (medications.length === 0 || !patientId || !diagnosis) {
        setError("Ajoutez au moins un médicament.");
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch("/api/v1/ai/smart-prescription", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            diagnosis,
            medications,
            notes: notes || undefined,
            warnings,
            status,
          }),
        });

        const result = (await response.json()) as { ok: boolean; error?: string };

        if (!result.ok) {
          setError(result.error ?? "Erreur lors de la sauvegarde.");
        }
      } catch {
        setError("Erreur réseau. Veuillez réessayer.");
      } finally {
        setIsSaving(false);
      }
    },
    [medications, patientId, diagnosis, notes, warnings],
  );

  const generateOrdonnance = useCallback(() => {
    if (medications.length === 0) return;

    const lineHeight = 20;
    let y = 60;
    const lines: string[] = [];

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const addLine = (text: string, fontSize = 12, bold = false) => {
      const weight = bold ? "bold" : "normal";
      lines.push(
        `<text x="40" y="${y}" font-size="${fontSize}" font-weight="${weight}" font-family="Helvetica, Arial, sans-serif">${escapeXml(text)}</text>`,
      );
      y += lineHeight + (fontSize > 12 ? 8 : 2);
    };

    addLine("ORDONNANCE MÉDICALE", 20, true);
    y += 5;
    addLine(`Date: ${new Date().toLocaleDateString("fr-FR")}`);
    addLine(`Diagnostic: ${diagnosis}`);
    y += 10;

    lines.push(`<line x1="40" y1="${y}" x2="560" y2="${y}" stroke="#ccc" stroke-width="1" />`);
    y += 15;

    addLine("Médicaments:", 14, true);
    y += 5;

    medications.forEach((med, i) => {
      addLine(`${i + 1}. ${med.name} — ${med.dosage}`, 12, true);
      addLine(`   ${med.frequency} pendant ${med.duration}`);
      if (med.instructions) {
        addLine(`   ${med.instructions}`);
      }
      y += 5;
    });

    if (notes) {
      y += 10;
      addLine("Notes:", 12, true);
      addLine(notes);
    }

    y += 40;
    lines.push(`<line x1="350" y1="${y}" x2="540" y2="${y}" stroke="#333" stroke-width="1" />`);
    y += 15;
    addLine("Signature du médecin");

    const pageHeight = Math.max(y + 60, 600);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="${pageHeight}">\n${lines.join("\n")}\n</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordonnance-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [medications, diagnosis, notes]);

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Tableau de bord", href: "/doctor/dashboard" },
          { label: "Prescription intelligente" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prescription Intelligente</h1>
          <p className="text-muted-foreground">
            Tapez un médicament, l&apos;IA complète le dosage et vérifie les interactions
          </p>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* Interaction Alerts */}
      {interactionAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" />
              Alertes d&apos;interactions médicamenteuses
              {isCheckingInteractions && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {interactionAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`rounded-md p-3 ${
                    alert.severity === "dangerous"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">{alert.title}</span>
                    <Badge variant={alert.severity === "dangerous" ? "destructive" : "outline"}>
                      {alert.severity === "dangerous" ? "Dangereux" : "Précaution"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">{alert.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Drug Search */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Recherche de médicament
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>ID Patient</Label>
                <Input
                  placeholder="ID du patient"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Diagnostic</Label>
                <Input
                  placeholder="Ex: Hypertension artérielle"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Symptômes (optionnel)</Label>
                <Input
                  placeholder="Ex: Céphalées, vertiges"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Nom du médicament (ex: Amoxicilline)"
                  value={drugSearch}
                  onChange={(e) => setDrugSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchDrug()}
                />
                <Button onClick={searchDrug} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI Result */}
          {aiResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5" />
                  Résultat IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {disclaimer && (
                  <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-700">
                    {disclaimer}
                  </div>
                )}

                <div className="rounded-md bg-blue-50 p-4">
                  <h3 className="font-semibold">{aiResult.medication.dci}</h3>
                  <p className="text-sm text-muted-foreground">{aiResult.medication.form}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Dosage:</span> {aiResult.medication.dosage}
                    </div>
                    <div>
                      <span className="font-medium">Fréquence:</span>{" "}
                      {aiResult.medication.frequency}
                    </div>
                    <div>
                      <span className="font-medium">Durée:</span> {aiResult.medication.duration}
                    </div>
                    <div>
                      <span className="font-medium">Instructions:</span>{" "}
                      {aiResult.medication.instructions}
                    </div>
                  </div>
                </div>

                {aiResult.interactions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Interactions</h4>
                    {aiResult.interactions.map((interaction, i) => (
                      <div
                        key={i}
                        className={`rounded-md p-2 text-sm ${
                          interaction.severity === "dangerous"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        <span className="font-medium">{interaction.drug}:</span>{" "}
                        {interaction.description}
                      </div>
                    ))}
                  </div>
                )}

                {aiResult.contraindications.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-red-700">Contre-indications</h4>
                    <ul className="list-disc pl-5 text-sm text-red-600">
                      {aiResult.contraindications.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-amber-700">Avertissements</h4>
                    <ul className="list-disc pl-5 text-sm text-amber-600">
                      {aiResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiResult.alternatives.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">Alternatives</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {aiResult.alternatives.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button onClick={addMedicationFromAI} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter à l&apos;ordonnance
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Prescription Draft */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ordonnance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {medications.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Recherchez un médicament et ajoutez-le à l&apos;ordonnance
              </p>
            ) : (
              <div className="space-y-3">
                {medications.map((med, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border p-3">
                    <div className="flex-1">
                      <div className="font-semibold">
                        {i + 1}. {med.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {med.dosage} — {med.frequency} — {med.duration}
                      </div>
                      {med.instructions && (
                        <div className="text-sm text-muted-foreground italic">
                          {med.instructions}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeMedication(i)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                placeholder="Notes pour le pharmacien..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => savePrescription("draft")}
                disabled={isSaving || medications.length === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                Brouillon
              </Button>
              <Button
                onClick={() => savePrescription("signed")}
                disabled={isSaving || medications.length === 0}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Signer
              </Button>
              <Button
                variant="outline"
                onClick={generateOrdonnance}
                disabled={medications.length === 0}
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FileText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}
