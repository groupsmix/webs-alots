"use client";

import { useState, useMemo } from "react";
import {
  Heart, Syringe, AlertTriangle, Droplets,
  Phone, FileText, ChevronDown, ChevronUp, Plus,
  Activity, Pill, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---- Types ----

export interface CarnetSanteData {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  gender: "M" | "F";
  bloodType?: string;
  allergies: string[];
  chronicConditions: string[];
  vaccinations: Vaccination[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  currentMedications: CurrentMedication[];
  medicalHistory: MedicalHistoryEntry[];
  vitalSigns?: VitalSigns;
}

interface Vaccination {
  name: string;
  date: string;
  nextDueDate?: string;
  batchNumber?: string;
  notes?: string;
}

interface CurrentMedication {
  name: string;
  dosage: string;
  prescribedBy: string;
  startDate: string;
  endDate?: string;
}

interface MedicalHistoryEntry {
  date: string;
  type: "consultation" | "hospitalization" | "surgery" | "lab" | "imaging";
  description: string;
  doctor: string;
  notes?: string;
}

interface VitalSigns {
  date: string;
  weight?: number; // kg
  height?: number; // cm
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
}

// ---- Constants ----

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const HISTORY_TYPE_CONFIG: Record<MedicalHistoryEntry["type"], { label: string; icon: typeof Heart; color: string }> = {
  consultation: { label: "Consultation", icon: Activity, color: "text-blue-600" },
  hospitalization: { label: "Hospitalisation", icon: Heart, color: "text-red-600" },
  surgery: { label: "Chirurgie", icon: Activity, color: "text-purple-600" },
  lab: { label: "Analyses", icon: Droplets, color: "text-green-600" },
  imaging: { label: "Imagerie", icon: Eye, color: "text-yellow-600" },
};

// ---- Component ----

interface CarnetSanteProps {
  data: CarnetSanteData;
  onUpdate?: (data: Partial<CarnetSanteData>) => void;
  readOnly?: boolean;
}

/**
 * CarnetSante
 *
 * Digital health booklet (Carnet de santé) for Moroccan patients.
 * Similar to the physical carnet de santé but digital.
 *
 * Sections:
 * - Patient identity & blood type
 * - Allergies & chronic conditions
 * - Vaccinations
 * - Current medications
 * - Medical history
 * - Emergency contact
 * - Vital signs
 */
function SectionHeader({
  id,
  title,
  icon: Icon,
  count,
  expandedSection,
  onToggle,
}: {
  id: string;
  title: string;
  icon: typeof Heart;
  count?: number;
  expandedSection: string | null;
  onToggle: (section: string) => void;
}) {
  return (
    <button
      className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/50 rounded-lg transition-colors"
      onClick={() => onToggle(id)}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{title}</span>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        )}
      </div>
      {expandedSection === id ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

export function CarnetSante({ data, onUpdate, readOnly = false }: CarnetSanteProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("identity");
  const [newAllergy, setNewAllergy] = useState("");
  const [newCondition, setNewCondition] = useState("");

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const addAllergy = () => {
    if (!newAllergy.trim()) return;
    onUpdate?.({ allergies: [...data.allergies, newAllergy.trim()] });
    setNewAllergy("");
  };

  const removeAllergy = (index: number) => {
    onUpdate?.({ allergies: data.allergies.filter((_, i) => i !== index) });
  };

  const addCondition = () => {
    if (!newCondition.trim()) return;
    onUpdate?.({ chronicConditions: [...data.chronicConditions, newCondition.trim()] });
    setNewCondition("");
  };

  const removeCondition = (index: number) => {
    onUpdate?.({ chronicConditions: data.chronicConditions.filter((_, i) => i !== index) });
  };

  const age = useMemo(() => {
    if (!data.dateOfBirth) return null;
    const now = new Date();
    const birth = new Date(data.dateOfBirth);
    let years = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      years--;
    }
    return years;
  }, [data.dateOfBirth]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-5 w-5 text-green-600" />
          Carnet de Santé — {data.patientName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Identity */}
        <SectionHeader id="identity" title="Identité" icon={Heart} expandedSection={expandedSection} onToggle={toggleSection} />
        {expandedSection === "identity" && (
          <div className="px-3 pb-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Nom:</span>
                <p className="font-medium">{data.patientName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date de naissance:</span>
                <p className="font-medium">
                  {new Date(data.dateOfBirth).toLocaleDateString("fr-MA")}
                  {age !== null && ` (${age} ans)`}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Sexe:</span>
                <p className="font-medium">{data.gender === "M" ? "Masculin" : "Féminin"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Groupe sanguin:</span>
                {readOnly ? (
                  <p className="font-medium text-red-600">{data.bloodType ?? "Non renseigné"}</p>
                ) : (
                  <select
                    value={data.bloodType ?? ""}
                    onChange={(e) => onUpdate?.({ bloodType: e.target.value || undefined })}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value="">Non renseigné</option>
                    {BLOOD_TYPES.map((bt) => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Vital Signs */}
            {data.vitalSigns && (
              <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-muted-foreground mb-2">
                  Derniers signes vitaux ({new Date(data.vitalSigns.date).toLocaleDateString("fr-MA")})
                </p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {data.vitalSigns.weight && (
                    <div className="text-center">
                      <p className="font-bold">{data.vitalSigns.weight} kg</p>
                      <p className="text-xs text-muted-foreground">Poids</p>
                    </div>
                  )}
                  {data.vitalSigns.height && (
                    <div className="text-center">
                      <p className="font-bold">{data.vitalSigns.height} cm</p>
                      <p className="text-xs text-muted-foreground">Taille</p>
                    </div>
                  )}
                  {data.vitalSigns.bloodPressureSystolic && data.vitalSigns.bloodPressureDiastolic && (
                    <div className="text-center">
                      <p className="font-bold">
                        {data.vitalSigns.bloodPressureSystolic}/{data.vitalSigns.bloodPressureDiastolic}
                      </p>
                      <p className="text-xs text-muted-foreground">Tension</p>
                    </div>
                  )}
                  {data.vitalSigns.heartRate && (
                    <div className="text-center">
                      <p className="font-bold">{data.vitalSigns.heartRate} bpm</p>
                      <p className="text-xs text-muted-foreground">Pouls</p>
                    </div>
                  )}
                  {data.vitalSigns.temperature && (
                    <div className="text-center">
                      <p className="font-bold">{data.vitalSigns.temperature}°C</p>
                      <p className="text-xs text-muted-foreground">Température</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Allergies */}
        <SectionHeader id="allergies" title="Allergies" icon={AlertTriangle} count={data.allergies.length} expandedSection={expandedSection} onToggle={toggleSection} />
        {expandedSection === "allergies" && (
          <div className="px-3 pb-3 space-y-2">
            {data.allergies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune allergie connue</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.allergies.map((allergy, i) => (
                  <Badge
                    key={i}
                    variant="destructive"
                    className="text-xs cursor-pointer"
                    onClick={() => !readOnly && removeAllergy(i)}
                  >
                    {allergy}
                    {!readOnly && " ×"}
                  </Badge>
                ))}
              </div>
            )}
            {!readOnly && (
              <div className="flex gap-2">
                <Input
                  placeholder="Nouvelle allergie..."
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addAllergy()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="outline" onClick={addAllergy} className="h-8">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Chronic Conditions */}
        <SectionHeader id="conditions" title="Maladies chroniques" icon={Activity} count={data.chronicConditions.length} expandedSection={expandedSection} onToggle={toggleSection} />
        {expandedSection === "conditions" && (
          <div className="px-3 pb-3 space-y-2">
            {data.chronicConditions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune maladie chronique</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.chronicConditions.map((condition, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs cursor-pointer"
                    onClick={() => !readOnly && removeCondition(i)}
                  >
                    {condition}
                    {!readOnly && " ×"}
                  </Badge>
                ))}
              </div>
            )}
            {!readOnly && (
              <div className="flex gap-2">
                <Input
                  placeholder="Nouvelle pathologie..."
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCondition()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="outline" onClick={addCondition} className="h-8">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Vaccinations */}
        <SectionHeader id="vaccinations" title="Vaccinations" icon={Syringe} count={data.vaccinations.length} expandedSection={expandedSection} onToggle={toggleSection} />
        {expandedSection === "vaccinations" && (
          <div className="px-3 pb-3 space-y-2">
            {data.vaccinations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vaccination enregistrée</p>
            ) : (
              <div className="space-y-2">
                {data.vaccinations.map((v, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                    <div>
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.date).toLocaleDateString("fr-MA")}
                        {v.batchNumber && ` — Lot: ${v.batchNumber}`}
                      </p>
                    </div>
                    {v.nextDueDate && (
                      <Badge variant="outline" className="text-xs">
                        Rappel: {new Date(v.nextDueDate).toLocaleDateString("fr-MA")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Current Medications */}
        <SectionHeader id="medications" title="Traitements en cours" icon={Pill} count={data.currentMedications.length} expandedSection={expandedSection} onToggle={toggleSection} />
        {expandedSection === "medications" && (
          <div className="px-3 pb-3 space-y-2">
            {data.currentMedications.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun traitement en cours</p>
            ) : (
              <div className="space-y-2">
                {data.currentMedications.map((m, i) => (
                  <div key={i} className="p-2 rounded-lg border text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{m.name} — {m.dosage}</p>
                      <Badge variant="secondary" className="text-xs">En cours</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Prescrit par {m.prescribedBy} — Depuis le {new Date(m.startDate).toLocaleDateString("fr-MA")}
                      {m.endDate && ` jusqu'au ${new Date(m.endDate).toLocaleDateString("fr-MA")}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Medical History */}
        <SectionHeader id="history" title="Antécédents" icon={FileText} count={data.medicalHistory.length} expandedSection={expandedSection} onToggle={toggleSection} />
        {expandedSection === "history" && (
          <div className="px-3 pb-3 space-y-2">
            {data.medicalHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun antécédent enregistré</p>
            ) : (
              <div className="space-y-2">
                {data.medicalHistory.map((h, i) => {
                  const config = HISTORY_TYPE_CONFIG[h.type];
                  const HistoryIcon = config.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg border text-sm">
                      <HistoryIcon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{h.description}</p>
                          <Badge variant="outline" className="text-xs">
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.date).toLocaleDateString("fr-MA")} — {h.doctor}
                          {h.notes && ` — ${h.notes}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Emergency Contact */}
        <SectionHeader id="emergency" title="Contact d'urgence" icon={Phone} expandedSection={expandedSection} onToggle={toggleSection} />
        {expandedSection === "emergency" && (
          <div className="px-3 pb-3">
            {data.emergencyContact ? (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm">
                <p className="font-medium">{data.emergencyContact.name}</p>
                <p className="text-muted-foreground">{data.emergencyContact.relationship}</p>
                <p className="font-medium mt-1">{data.emergencyContact.phone}</p>
              </div>
            ) : !readOnly ? (
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input placeholder="Nom du contact d'urgence" className="h-8 text-sm" />
                <Label>Téléphone</Label>
                <Input placeholder="+212 6 XX XX XX XX" className="h-8 text-sm" />
                <Label>Lien</Label>
                <Input placeholder="Ex: Époux/épouse, Parent..." className="h-8 text-sm" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Non renseigné</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
