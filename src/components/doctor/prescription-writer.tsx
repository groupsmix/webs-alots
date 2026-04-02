"use client";

import { Plus, Trash2, FileDown, Send, Sparkles, Check, Pencil, RefreshCw, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { AiSuggestionsPanel } from "@/components/dashboard/ai-suggestions-panel";
import { DrugSearch, type DrugSelection } from "@/components/prescription/drug-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import {
  getCurrentUser,
  fetchPatients,
  type PatientView,
  type ClinicUser,
} from "@/lib/data/client";
import { generatePrescriptionNumber } from "@/lib/prescription-id";
import { downloadPrescriptionPDF } from "@/lib/prescription-pdf";
import {
  buildPrescriptionQRData,
  generatePrescriptionQRDataURL,
} from "@/lib/prescription-qr";

interface Medication {
  _id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

type AiSuggestionState = "idle" | "loading" | "suggested" | "accepted" | "editing";

interface AiPrescriptionResult {
  medications: { name: string; dosage: string; frequency: string; duration: string; instructions: string }[];
  notes: string;
  warnings: string[];
}

/**
 * PrescriptionWriter
 *
 * Form to create prescriptions for a patient.
 * Features:
 * - DCI drug search/autocomplete
 * - AI-powered prescription generation
 * - Unique prescription ID (RX-YYYY-XXXXXX)
 * - QR code with structured prescription data
 * - Generates downloadable PDF with QR code
 */
export function PrescriptionWriter() {
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [medications, setMedications] = useState<Medication[]>([
    { _id: crypto.randomUUID(), name: "", dosage: "", frequency: "", duration: "", instructions: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [doctorName, setDoctorName] = useState("");
  const [doctorNameAr, setDoctorNameAr] = useState("");
  const [doctorINPE, setDoctorINPE] = useState("");
  const [clinicName, setClinicName] = useState("");

  // AI state
  const [aiState, setAiState] = useState<AiSuggestionState>("idle");
  const [aiResult, setAiResult] = useState<AiPrescriptionResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [preAiMedications, setPreAiMedications] = useState<Medication[] | null>(null);
  const [preAiNotes, setPreAiNotes] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }

      // Extract doctor info from the current user
      setDoctorName(user.name ?? "");
      const userRecord = user as ClinicUser & { name_ar?: string; metadata?: { inpe_number?: string }; clinic_name?: string };
      setDoctorNameAr(userRecord.name_ar ?? "");
      if (userRecord.metadata?.inpe_number) {
        setDoctorINPE(userRecord.metadata.inpe_number);
      }
      setClinicName(userRecord.clinic_name ?? "");

      const pts = await fetchPatients(user.clinic_id);
      if (controller.signal.aborted) return;
      setPatients(pts);
      if (pts.length > 0) setSelectedPatient(pts[0].id);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  const patient = patients.find((p) => p.id === selectedPatient) ?? patients[0];

  // ── AI Prescription Generation ──

  const handleAiGenerate = useCallback(async () => {
    if (!diagnosis.trim()) {
      setAiError("Veuillez entrer un diagnostic avant de générer.");
      return;
    }
    if (!selectedPatient) {
      setAiError("Veuillez sélectionner un patient.");
      return;
    }

    setAiState("loading");
    setAiError(null);
    setAiResult(null);

    // Save current state for potential revert
    setPreAiMedications([...medications]);
    setPreAiNotes(notes);

    try {
      const response = await fetch("/api/v1/ai/prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient,
          diagnosis: diagnosis.trim(),
          symptoms: symptoms.trim() || undefined,
          patientContext: patient ? {
            age: patient.age || undefined,
            gender: patient.gender || undefined,
            allergies: patient.allergies?.length ? patient.allergies : undefined,
          } : undefined,
        }),
      });

      const result = await response.json() as {
        ok: boolean;
        data?: { prescription: AiPrescriptionResult };
        error?: string;
      };

      if (!response.ok || !result.ok) {
        setAiState("idle");
        setAiError(result.error ?? "Erreur lors de la génération IA.");
        return;
      }

      const prescription = result.data?.prescription;
      if (!prescription) {
        setAiState("idle");
        setAiError("Réponse IA invalide.");
        return;
      }

      setAiResult(prescription);

      // Auto-fill the medication table with AI suggestions
      const aiMeds: Medication[] = prescription.medications.map((m) => ({
        _id: crypto.randomUUID(),
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        instructions: m.instructions,
      }));

      setMedications(aiMeds);
      if (prescription.notes) {
        setNotes(prescription.notes);
      }
      setAiState("suggested");
    } catch (err) {
      setAiState("idle");
      setAiError(
        err instanceof Error ? err.message : "Erreur réseau. Veuillez réessayer.",
      );
    }
  }, [diagnosis, symptoms, selectedPatient, patient, medications, notes]);

  const handleAiAccept = useCallback(() => {
    setAiState("accepted");
    setPreAiMedications(null);
    setPreAiNotes(null);
  }, []);

  const handleAiEdit = useCallback(() => {
    setAiState("editing");
  }, []);

  const handleAiRegenerate = useCallback(() => {
    if (preAiMedications) {
      setMedications(preAiMedications);
    }
    if (preAiNotes !== null) {
      setNotes(preAiNotes);
    }
    setAiState("idle");
    setAiResult(null);
    setTimeout(() => {
      void handleAiGenerate();
    }, 0);
  }, [preAiMedications, preAiNotes, handleAiGenerate]);

  // Handler for accepting a single medication from AI suggestions panel
  const handleAcceptSuggestion = useCallback(
    (med: { name: string; dosage: string; frequency: string; duration: string; instructions: string }) => {
      setMedications((prev) => [
        ...prev,
        {
          _id: crypto.randomUUID(),
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          instructions: med.instructions,
        },
      ]);
    },
    [],
  );

  // Handler for accepting all medications from AI suggestions panel
  const handleAcceptAllSuggestions = useCallback(
    (meds: { name: string; dosage: string; frequency: string; duration: string; instructions: string }[]) => {
      const newMeds = meds.map((m) => ({
        _id: crypto.randomUUID(),
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        instructions: m.instructions,
      }));
      setMedications(newMeds);
    },
    [],
  );

  // ── Medication helpers ──

  if (loading) {
    return <PageLoader message="Loading..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const addMedication = () => {
    setMedications([
      ...medications,
      { _id: crypto.randomUUID(), name: "", dosage: "", frequency: "", duration: "", instructions: "" },
    ]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleDrugSelect = (index: number, selection: DrugSelection) => {
    const updated = [...medications];
    updated[index] = {
      ...updated[index],
      name: selection.dci,
      dosage: selection.strength ?? updated[index].dosage,
    };
    setMedications(updated);
  };

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      const prescriptionNumber = generatePrescriptionNumber();
      const date = new Date().toISOString().split("T")[0];

      // Build QR data
      const qrData = buildPrescriptionQRData({
        prescriptionNumber,
        doctorINPE: doctorINPE || "N/A",
        doctorName: doctorName || "Doctor",
        patientName: patient?.name ?? "Patient",
        patientDOB: patient?.dateOfBirth,
        date,
        clinicName: clinicName || "Clinic",
        diagnosis: diagnosis || undefined,
        medications: medications
          .filter((m) => m.name.trim() !== "")
          .map((m) => ({
            dci: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
            instructions: m.instructions || undefined,
          })),
      });

      // Generate QR code as data URL
      const qrCodeDataURL = await generatePrescriptionQRDataURL(qrData);

      downloadPrescriptionPDF({
        patientName: patient?.name ?? "Patient",
        patientAge: patient?.age,
        patientGender: patient?.gender,
        diagnosis,
        medications,
        notes,
        doctorName,
        doctorNameAr: doctorNameAr || undefined,
        clinicName,
        date,
        prescriptionNumber,
        doctorINPE: doctorINPE || undefined,
        qrCodeDataURL,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Main prescription form */}
      <div className="flex-1 space-y-4 min-w-0">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prescription Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Patient</Label>
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="space-y-2">
              <Label>Doctor Arabic Name (optional)</Label>
              <Input
                placeholder="e.g., د. محمد"
                value={doctorNameAr}
                onChange={(e) => setDoctorNameAr(e.target.value)}
                dir="rtl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Diagnosis</Label>
              <Input
                placeholder="Enter diagnosis..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Symptoms (optional, helps AI generate better prescriptions)</Label>
              <Input
                placeholder="e.g., fièvre, toux sèche, douleurs articulaires..."
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
              />
            </div>
          </div>

          {/* AI Generate Button */}
          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => void handleAiGenerate()}
              disabled={aiState === "loading" || !diagnosis.trim()}
              className="border-violet-300 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-900/20"
            >
              {aiState === "loading" ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Générer avec IA
                </>
              )}
            </Button>
            {aiError && (
              <p className="text-sm text-red-600 dark:text-red-400">{aiError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Warnings */}
      {aiResult?.warnings && aiResult.warnings.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm text-amber-800 dark:text-amber-300">Avertissements IA</p>
                <ul className="text-sm text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                  {aiResult.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Accept/Edit/Regenerate Controls */}
      {aiState === "suggested" && (
        <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <span className="text-sm font-medium text-violet-800 dark:text-violet-300">
                  Prescription générée par IA — Veuillez vérifier avant de valider
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAiAccept}
                  className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Accepter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAiEdit}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAiRegenerate}
                  className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Régénérer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Medications
              {aiState === "suggested" && (
                <Badge variant="outline" className="ml-2 text-xs border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400">
                  IA
                </Badge>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addMedication}>
              <Plus className="h-4 w-4 mr-1" />
              Add Medication
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {medications.map((med, index) => (
              <div
                key={med._id}
                className={`border rounded-lg p-4 space-y-3 ${
                  aiState === "suggested"
                    ? "border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-900/5"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Medication {index + 1}</Badge>
                  {medications.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMedication(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Medication Name (DCI)</Label>
                    <DrugSearch
                      value={med.name}
                      onChange={(val) => updateMedication(index, "name", val)}
                      onSelect={(sel) => handleDrugSelect(index, sel)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dosage</Label>
                    <Input
                      placeholder="e.g., 500mg"
                      value={med.dosage}
                      onChange={(e) => updateMedication(index, "dosage", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Input
                      placeholder="e.g., 3 times/day"
                      value={med.frequency}
                      onChange={(e) => updateMedication(index, "frequency", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input
                      placeholder="e.g., 7 days"
                      value={med.duration}
                      onChange={(e) => updateMedication(index, "duration", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Special Instructions</Label>
                    <Input
                      placeholder="e.g., Take with food"
                      value={med.instructions}
                      onChange={(e) => updateMedication(index, "instructions", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Any additional notes for the patient..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleDownloadPDF}
                disabled={generating}
              >
                <FileDown className="h-4 w-4 mr-2" />
                {generating ? "Generating..." : "Download PDF with QR"}
              </Button>
              <Button variant="outline" className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                Send to Patient ({patient?.name ?? "Patient"})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

      {/* AI Suggestions Panel — floating alongside */}
      <div className="hidden lg:block w-80 shrink-0">
        <div className="sticky top-6">
          <AiSuggestionsPanel
            diagnosis={diagnosis}
            patientId={selectedPatient || undefined}
            patientContext={patient ? {
              age: patient.age || undefined,
              gender: (patient.gender as "M" | "F") || undefined,
              allergies: patient.allergies?.length ? patient.allergies : undefined,
            } : undefined}
            onAcceptMedication={handleAcceptSuggestion}
            onAcceptAllMedications={handleAcceptAllSuggestions}
          />
        </div>
      </div>
    </div>
  );
}
