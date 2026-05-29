"use client";

/* eslint-disable i18next/no-literal-string -- Clinical encounter UI: all text intentionally in French per project requirements */

/**
 * Single-Page Clinical Encounter Flow
 *
 * Adapted from ECC healthcare-emr-patterns skill.
 * Vertical scroll: complaint → exam → vitals → diagnosis → medications → sign.
 * Locked encounter pattern: no edits after sign, addendum only.
 * Clinical UI: 4.5:1 contrast, 44x44px touch targets, keyboard navigation.
 * All text in FRENCH.
 */

import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  FileText,
  Heart,
  Lock,
  MessageSquarePlus,
  Pill,
  Save,
  Stethoscope,
  ThermometerSun,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calculateNEWS2 } from "@/lib/cdss/news2";
import type { NEWS2Result } from "@/lib/cdss/types";
import type {
  EncounterStatus,
  EncounterVitals,
  EncounterMedication,
  EncounterAddendum,
} from "@/lib/types/encounter";
import { CLINICAL_TEMPLATES } from "@/lib/types/encounter";

// ── NEWS2 Risk badge colors ──

function news2BadgeVariant(risk: string): "default" | "secondary" | "destructive" | "outline" {
  switch (risk) {
    case "high":
      return "destructive";
    case "medium":
      return "destructive";
    case "low-medium":
      return "secondary";
    default:
      return "outline";
  }
}

// ── Red Flag Alert Component ──

function RedFlagAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center gap-3 rounded-lg border-2 border-red-600 bg-red-50 p-4 text-red-900 dark:bg-red-950 dark:text-red-100"
      style={{ minHeight: "44px" }}
    >
      <AlertTriangle className="size-6 shrink-0 text-red-600" aria-hidden="true" />
      <div>
        <p className="font-bold">Drapeau rouge</p>
        <p>{message}</p>
      </div>
    </div>
  );
}

// ── Encounter Section Header ──

function SectionHeader({
  icon: Icon,
  title,
  step,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  step: number;
}) {
  return (
    <div className="flex items-center gap-3 pb-2">
      <span
        className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        aria-hidden="true"
      >
        {step}
      </span>
      <Icon className="size-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
    </div>
  );
}

export default function EncounterPage() {
  // ── State ──
  const [status, setStatus] = useState<EncounterStatus>("in_progress");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState("");
  const [examination, setExamination] = useState("");
  const [vitals, setVitals] = useState<EncounterVitals>({});
  const [diagnosis, setDiagnosis] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [medications, setMedications] = useState<EncounterMedication[]>([]);
  const [investigations, setInvestigations] = useState("");
  const [plan, setPlan] = useState("");
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [addenda, setAddenda] = useState<EncounterAddendum[]>([]);
  const [showAddendumDialog, setShowAddendumDialog] = useState(false);
  const [addendumText, setAddendumText] = useState("");
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const isLocked = status === "signed" || status === "addendum";

  // ── NEWS2 auto-calculation ──
  const news2Result: NEWS2Result | null = useMemo(() => {
    if (
      vitals.respiratoryRate &&
      vitals.oxygenSaturation &&
      vitals.temperature &&
      vitals.systolicBP &&
      vitals.heartRate &&
      vitals.consciousness
    ) {
      return calculateNEWS2({
        respiratoryRate: vitals.respiratoryRate,
        oxygenSaturation: vitals.oxygenSaturation,
        supplementalOxygen: vitals.supplementalOxygen ?? false,
        temperature: vitals.temperature,
        systolicBP: vitals.systolicBP,
        heartRate: vitals.heartRate,
        consciousness: vitals.consciousness,
      });
    }
    return null;
  }, [vitals]);

  // ── Template selection ──
  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      if (isLocked) return;
      const template = CLINICAL_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return;
      setSelectedTemplate(templateId);
      setSelectedChips([]);
      setRedFlags([]);
    },
    [isLocked],
  );

  // ── Chip toggle ──
  const handleChipToggle = useCallback(
    (chip: string) => {
      if (isLocked) return;
      setSelectedChips((prev) => {
        const next = prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip];

        const template = CLINICAL_TEMPLATES.find((t) => t.id === selectedTemplate);
        if (template) {
          const triggered = template.redFlags.filter((rf) =>
            next.some((c) => rf.toLowerCase().includes(c.toLowerCase())),
          );
          setRedFlags(triggered);
        }

        const complaintParts = next.join(", ");
        setChiefComplaint(complaintParts);
        return next;
      });
    },
    [isLocked, selectedTemplate],
  );

  // ── Vitals update ──
  const updateVital = useCallback(
    (field: keyof EncounterVitals, value: string) => {
      if (isLocked) return;
      setVitals((prev) => ({
        ...prev,
        [field]:
          field === "consciousness" || field === "supplementalOxygen"
            ? value
            : Number(value) || undefined,
      }));
    },
    [isLocked],
  );

  // ── Medication management ──
  const addMedication = useCallback(() => {
    if (isLocked) return;
    setMedications((prev) => [
      ...prev,
      { drugName: "", dose: "", route: "oral", frequency: "", duration: "" },
    ]);
  }, [isLocked]);

  const updateMedication = useCallback(
    (index: number, field: keyof EncounterMedication, value: string) => {
      if (isLocked) return;
      setMedications((prev) =>
        prev.map((med, i) => (i === index ? { ...med, [field]: value } : med)),
      );
    },
    [isLocked],
  );

  const removeMedication = useCallback(
    (index: number) => {
      if (isLocked) return;
      setMedications((prev) => prev.filter((_, i) => i !== index));
    },
    [isLocked],
  );

  // ── Sign encounter ──
  const handleSign = useCallback(() => {
    setSaving(true);
    setStatus("signed");
    setShowSignDialog(false);
    setSaving(false);
  }, []);

  // ── Add addendum ──
  const handleAddAddendum = useCallback(() => {
    if (!addendumText.trim()) return;
    const newAddendum: EncounterAddendum = {
      id: `addendum-${Date.now()}`,
      encounterId: "current",
      authorId: "current-doctor",
      clinicId: "current-clinic",
      content: addendumText.trim(),
      createdAt: new Date().toISOString(),
    };
    setAddenda((prev) => [...prev, newAddendum]);
    setAddendumText("");
    setShowAddendumDialog(false);
    setStatus("addendum");
  }, [addendumText]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <Breadcrumb
        items={[
          { label: "Tableau de bord", href: "/doctor/dashboard" },
          { label: "Consultation clinique" },
        ]}
      />

      {/* ── Patient Header (sticky) ── */}
      <div className="sticky top-0 z-10 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Consultation clinique
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Flux de consultation en page unique
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLocked ? (
              <Badge variant="secondary" className="gap-1">
                <Lock className="size-3" aria-hidden="true" />
                Verrouillée
              </Badge>
            ) : (
              <Badge variant="outline">En cours</Badge>
            )}
            {news2Result && (
              <Badge variant={news2BadgeVariant(news2Result.risk)}>
                NEWS2: {news2Result.total} ({news2Result.risk})
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Red Flag Alerts ── */}
      {redFlags.map((flag) => (
        <RedFlagAlert key={flag} message={flag} />
      ))}

      {/* ── NEWS2 Escalation Alert ── */}
      {news2Result && (news2Result.risk === "high" || news2Result.risk === "medium") && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-3 rounded-lg border-2 border-red-600 bg-red-50 p-4 text-red-900 dark:bg-red-950 dark:text-red-100"
        >
          <Heart className="size-6 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="font-bold">
              Score NEWS2 : {news2Result.total} — Risque {news2Result.risk.toUpperCase()}
            </p>
            <p>{news2Result.escalation}</p>
          </div>
        </div>
      )}

      {/* ── 1. Chief Complaint ── */}
      <Card>
        <CardHeader>
          <SectionHeader icon={ClipboardList} title="Motif de consultation" step={1} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="template-select">Modèle clinique</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CLINICAL_TEMPLATES.map((template) => (
                <Button
                  key={template.id}
                  variant={selectedTemplate === template.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTemplateSelect(template.id)}
                  disabled={isLocked}
                  className="min-h-[44px] min-w-[44px]"
                  aria-label={`Sélectionner le modèle ${template.name}`}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </div>

          {selectedTemplate && (
            <div>
              <Label>Symptômes (cliquez pour sélectionner)</Label>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Symptômes">
                {CLINICAL_TEMPLATES.find((t) => t.id === selectedTemplate)?.chips.map((chip) => (
                  <Button
                    key={chip}
                    variant={selectedChips.includes(chip) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleChipToggle(chip)}
                    disabled={isLocked}
                    className="min-h-[44px] min-w-[44px]"
                    aria-pressed={selectedChips.includes(chip)}
                  >
                    {chip}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="chief-complaint">Motif de consultation (texte libre)</Label>
            <Textarea
              id="chief-complaint"
              value={chiefComplaint}
              onChange={(e) => !isLocked && setChiefComplaint(e.target.value)}
              placeholder="Décrivez le motif de consultation..."
              disabled={isLocked}
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── 2. History of Present Illness ── */}
      <Card>
        <CardHeader>
          <SectionHeader icon={FileText} title="Histoire de la maladie actuelle" step={2} />
        </CardHeader>
        <CardContent>
          <Label htmlFor="hpi">Anamnèse</Label>
          <Textarea
            id="hpi"
            value={historyOfPresentIllness}
            onChange={(e) => !isLocked && setHistoryOfPresentIllness(e.target.value)}
            placeholder="Décrivez l'évolution des symptômes..."
            disabled={isLocked}
            className="mt-1"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* ── 3. Physical Examination ── */}
      <Card>
        <CardHeader>
          <SectionHeader icon={Stethoscope} title="Examen physique" step={3} />
        </CardHeader>
        <CardContent>
          <Label htmlFor="examination">Résultats de l&apos;examen</Label>
          <Textarea
            id="examination"
            value={examination}
            onChange={(e) => !isLocked && setExamination(e.target.value)}
            placeholder="Documenter les résultats de l'examen par système..."
            disabled={isLocked}
            className="mt-1"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* ── 4. Vitals (auto-trigger NEWS2) ── */}
      <Card>
        <CardHeader>
          <SectionHeader icon={ThermometerSun} title="Signes vitaux" step={4} />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="vital-hr">Fréquence cardiaque (bpm)</Label>
              <Input
                id="vital-hr"
                type="number"
                value={vitals.heartRate ?? ""}
                onChange={(e) => updateVital("heartRate", e.target.value)}
                disabled={isLocked}
                className="mt-1 min-h-[44px]"
                min={0}
                max={300}
              />
            </div>
            <div>
              <Label htmlFor="vital-sbp">TA systolique (mmHg)</Label>
              <Input
                id="vital-sbp"
                type="number"
                value={vitals.systolicBP ?? ""}
                onChange={(e) => updateVital("systolicBP", e.target.value)}
                disabled={isLocked}
                className="mt-1 min-h-[44px]"
                min={0}
                max={300}
              />
            </div>
            <div>
              <Label htmlFor="vital-dbp">TA diastolique (mmHg)</Label>
              <Input
                id="vital-dbp"
                type="number"
                value={vitals.diastolicBP ?? ""}
                onChange={(e) => updateVital("diastolicBP", e.target.value)}
                disabled={isLocked}
                className="mt-1 min-h-[44px]"
                min={0}
                max={300}
              />
            </div>
            <div>
              <Label htmlFor="vital-temp">Température (°C)</Label>
              <Input
                id="vital-temp"
                type="number"
                step="0.1"
                value={vitals.temperature ?? ""}
                onChange={(e) => updateVital("temperature", e.target.value)}
                disabled={isLocked}
                className="mt-1 min-h-[44px]"
                min={30}
                max={45}
              />
            </div>
            <div>
              <Label htmlFor="vital-rr">Fréquence respiratoire (/min)</Label>
              <Input
                id="vital-rr"
                type="number"
                value={vitals.respiratoryRate ?? ""}
                onChange={(e) => updateVital("respiratoryRate", e.target.value)}
                disabled={isLocked}
                className="mt-1 min-h-[44px]"
                min={0}
                max={60}
              />
            </div>
            <div>
              <Label htmlFor="vital-spo2">SpO₂ (%)</Label>
              <Input
                id="vital-spo2"
                type="number"
                value={vitals.oxygenSaturation ?? ""}
                onChange={(e) => updateVital("oxygenSaturation", e.target.value)}
                disabled={isLocked}
                className="mt-1 min-h-[44px]"
                min={0}
                max={100}
              />
            </div>
            <div>
              <Label htmlFor="vital-weight">Poids (kg)</Label>
              <Input
                id="vital-weight"
                type="number"
                step="0.1"
                value={vitals.weight ?? ""}
                onChange={(e) => updateVital("weight", e.target.value)}
                disabled={isLocked}
                className="mt-1 min-h-[44px]"
                min={0}
                max={500}
              />
            </div>
            <div>
              <Label htmlFor="vital-consciousness">Conscience (AVPU)</Label>
              <select
                id="vital-consciousness"
                value={vitals.consciousness ?? ""}
                onChange={(e) => updateVital("consciousness", e.target.value)}
                disabled={isLocked}
                className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                aria-label="Niveau de conscience"
              >
                <option value="">Sélectionner</option>
                <option value="alert">Alerte (A)</option>
                <option value="voice">Réponse vocale (V)</option>
                <option value="pain">Réponse douleur (P)</option>
                <option value="unresponsive">Inconscient (U)</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label htmlFor="vital-o2" className="flex min-h-[44px] items-center gap-2">
                <input
                  id="vital-o2"
                  type="checkbox"
                  checked={vitals.supplementalOxygen ?? false}
                  onChange={(e) =>
                    !isLocked &&
                    setVitals((prev) => ({ ...prev, supplementalOxygen: e.target.checked }))
                  }
                  disabled={isLocked}
                  className="size-5"
                />
                <span className="text-sm">O₂ supplémentaire</span>
              </label>
            </div>
          </div>

          {/* NEWS2 Score Display */}
          {news2Result && (
            <div
              className={`mt-4 rounded-lg border-2 p-4 ${
                news2Result.risk === "high" || news2Result.risk === "medium"
                  ? "border-red-500 bg-red-50 dark:bg-red-950"
                  : news2Result.risk === "low-medium"
                    ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
                    : "border-green-500 bg-green-50 dark:bg-green-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">Score NEWS2</span>
                <Badge variant={news2BadgeVariant(news2Result.risk)}>
                  {news2Result.total} — {news2Result.risk.toUpperCase()}
                </Badge>
              </div>
              <p className="mt-1 text-sm">{news2Result.escalation}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs md:grid-cols-4">
                {Object.entries(news2Result.components).map(([key, value]) => (
                  <span key={key} className="rounded bg-white/50 px-2 py-1 dark:bg-black/20">
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5. Diagnosis ── */}
      <Card>
        <CardHeader>
          <SectionHeader icon={FileText} title="Diagnostic" step={5} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="diagnosis">Diagnostic</Label>
            <Textarea
              id="diagnosis"
              value={diagnosis}
              onChange={(e) => !isLocked && setDiagnosis(e.target.value)}
              placeholder="Diagnostic principal..."
              disabled={isLocked}
              className="mt-1"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="icd-code">Code CIM-10</Label>
            <Input
              id="icd-code"
              value={icdCode}
              onChange={(e) => !isLocked && setIcdCode(e.target.value)}
              placeholder="Ex: I21.9"
              disabled={isLocked}
              className="mt-1 min-h-[44px]"
            />
            {selectedTemplate && (
              <div className="mt-2 flex flex-wrap gap-1">
                {CLINICAL_TEMPLATES.find((t) => t.id === selectedTemplate)?.icdSuggestions.map(
                  (code) => (
                    <Button
                      key={code}
                      variant="outline"
                      size="sm"
                      onClick={() => !isLocked && setIcdCode(code)}
                      disabled={isLocked}
                      className="min-h-[44px] text-xs"
                    >
                      {code}
                    </Button>
                  ),
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 6. Medications ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SectionHeader icon={Pill} title="Ordonnance" step={6} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {medications.map((med, index) => (
            <div key={index} className="space-y-2 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <div>
                  <Label htmlFor={`med-name-${index}`}>Médicament (DCI)</Label>
                  <Input
                    id={`med-name-${index}`}
                    value={med.drugName}
                    onChange={(e) => updateMedication(index, "drugName", e.target.value)}
                    placeholder="Nom du médicament"
                    disabled={isLocked}
                    className="mt-1 min-h-[44px]"
                  />
                </div>
                <div>
                  <Label htmlFor={`med-dose-${index}`}>Dose</Label>
                  <Input
                    id={`med-dose-${index}`}
                    value={med.dose}
                    onChange={(e) => updateMedication(index, "dose", e.target.value)}
                    placeholder="Ex: 500mg"
                    disabled={isLocked}
                    className="mt-1 min-h-[44px]"
                  />
                </div>
                <div>
                  <Label htmlFor={`med-route-${index}`}>Voie</Label>
                  <select
                    id={`med-route-${index}`}
                    value={med.route}
                    onChange={(e) => updateMedication(index, "route", e.target.value)}
                    disabled={isLocked}
                    className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  >
                    <option value="oral">Orale</option>
                    <option value="iv">IV</option>
                    <option value="im">IM</option>
                    <option value="sc">SC</option>
                    <option value="topical">Topique</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor={`med-freq-${index}`}>Fréquence</Label>
                  <Input
                    id={`med-freq-${index}`}
                    value={med.frequency}
                    onChange={(e) => updateMedication(index, "frequency", e.target.value)}
                    placeholder="Ex: 3x/jour"
                    disabled={isLocked}
                    className="mt-1 min-h-[44px]"
                  />
                </div>
                <div>
                  <Label htmlFor={`med-dur-${index}`}>Durée</Label>
                  <Input
                    id={`med-dur-${index}`}
                    value={med.duration}
                    onChange={(e) => updateMedication(index, "duration", e.target.value)}
                    placeholder="Ex: 7 jours"
                    disabled={isLocked}
                    className="mt-1 min-h-[44px]"
                  />
                </div>
              </div>
              {!isLocked && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeMedication(index)}
                  className="min-h-[44px] text-red-600"
                  aria-label={`Supprimer ${med.drugName || "médicament"}`}
                >
                  Supprimer
                </Button>
              )}
            </div>
          ))}
          {!isLocked && (
            <Button variant="outline" onClick={addMedication} className="min-h-[44px] min-w-[44px]">
              <Pill className="mr-2 size-4" aria-hidden="true" />
              Ajouter un médicament
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── 7. Investigations ── */}
      <Card>
        <CardHeader>
          <SectionHeader icon={ClipboardList} title="Examens complémentaires" step={7} />
        </CardHeader>
        <CardContent>
          <Label htmlFor="investigations">Bilans et imagerie demandés</Label>
          <Textarea
            id="investigations"
            value={investigations}
            onChange={(e) => !isLocked && setInvestigations(e.target.value)}
            placeholder="Bilans biologiques, imagerie..."
            disabled={isLocked}
            className="mt-1"
            rows={3}
          />
        </CardContent>
      </Card>

      {/* ── 8. Plan & Follow-up ── */}
      <Card>
        <CardHeader>
          <SectionHeader icon={FileText} title="Plan et suivi" step={8} />
        </CardHeader>
        <CardContent>
          <Label htmlFor="plan">Plan thérapeutique</Label>
          <Textarea
            id="plan"
            value={plan}
            onChange={(e) => !isLocked && setPlan(e.target.value)}
            placeholder="Conduite à tenir, suivi recommandé..."
            disabled={isLocked}
            className="mt-1"
            rows={3}
          />
        </CardContent>
      </Card>

      {/* ── 9. Sign / Lock / Addendum ── */}
      <Card>
        <CardHeader>
          <SectionHeader
            icon={isLocked ? Lock : CheckCircle}
            title={isLocked ? "Consultation verrouillée" : "Signer la consultation"}
            step={9}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {isLocked ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cette consultation est verrouillée. Aucune modification n&apos;est possible. Seuls
                les addendums peuvent être ajoutés.
              </p>

              {/* Addenda list */}
              {addenda.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Addendums</h3>
                  {addenda.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-950"
                    >
                      <p className="text-sm">{a.content}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(a.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => setShowAddendumDialog(true)}
                className="min-h-[44px] min-w-[44px]"
              >
                <MessageSquarePlus className="mr-2 size-4" aria-hidden="true" />
                Ajouter un addendum
              </Button>
            </>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" className="min-h-[44px] min-w-[44px]" disabled={saving}>
                <Save className="mr-2 size-4" aria-hidden="true" />
                Enregistrer le brouillon
              </Button>
              <Button
                variant="default"
                onClick={() => setShowSignDialog(true)}
                className="min-h-[44px] min-w-[44px] bg-green-700 hover:bg-green-800"
                disabled={saving}
              >
                <CheckCircle className="mr-2 size-4" aria-hidden="true" />
                Signer et verrouiller
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sign Confirmation Dialog ── */}
      <Dialog open={showSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la signature</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Une fois signée, cette consultation sera verrouillée. Aucune modification ne sera
            possible — seuls des addendums pourront être ajoutés. Voulez-vous continuer ?
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowSignDialog(false)}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              variant="default"
              onClick={handleSign}
              className="min-h-[44px] bg-green-700 hover:bg-green-800"
              disabled={saving}
            >
              Signer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Addendum Dialog ── */}
      <Dialog open={showAddendumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un addendum</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="addendum-text">Contenu de l&apos;addendum</Label>
            <Textarea
              id="addendum-text"
              value={addendumText}
              onChange={(e) => setAddendumText(e.target.value)}
              placeholder="Résultats complémentaires, corrections..."
              className="mt-1"
              rows={4}
            />
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAddendumDialog(false)}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              variant="default"
              onClick={handleAddAddendum}
              className="min-h-[44px]"
              disabled={!addendumText.trim()}
            >
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
