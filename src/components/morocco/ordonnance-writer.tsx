"use client";

import { useState } from "react";
import { FileDown, Send, Plus, Trash2, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// ---- Types ----

interface OrdonnanceMedication {
  /** DCI (Dénomination Commune Internationale) - generic name */
  dci: string;
  /** Brand name (optional) */
  brandName?: string;
  /** Forme pharmaceutique (comprimé, gélule, sirop, etc.) */
  forme: string;
  /** Dosage (e.g., "500mg", "1g") */
  dosage: string;
  /** Posologie (e.g., "1 cp x 3/jour") */
  posologie: string;
  /** Durée du traitement (e.g., "7 jours", "1 mois") */
  duree: string;
  /** Instructions spéciales */
  instructions?: string;
  /** Quantité totale à délivrer */
  quantite?: string;
}

interface OrdonnanceData {
  doctorName: string;
  doctorSpecialty: string;
  doctorPhone: string;
  clinicName: string;
  clinicAddress: string;
  clinicCity: string;
  /** Numéro d'inscription à l'Ordre (CNOM) */
  orderNumber: string;
  patientName: string;
  patientAge?: number;
  patientWeight?: string;
  date: string;
  diagnosis?: string;
  medications: OrdonnanceMedication[];
  notes?: string;
}

// ---- HTML Escaping ----

function escapeHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Formes pharmaceutiques ----

const FORMES_OPTIONS = [
  "Comprimé",
  "Gélule",
  "Sirop",
  "Sachet",
  "Suppositoire",
  "Injectable (IM)",
  "Injectable (IV)",
  "Pommade",
  "Crème",
  "Collyre",
  "Gouttes",
  "Spray nasal",
  "Inhalateur",
  "Ovule",
  "Patch",
];

// ---- Component ----

interface OrdonnanceWriterProps {
  doctorName: string;
  doctorSpecialty: string;
  doctorPhone: string;
  clinicName: string;
  clinicAddress: string;
  clinicCity: string;
  orderNumber: string;
  patients: { id: string; name: string; age?: number }[];
  onSendWhatsApp?: (ordonnance: OrdonnanceData) => void;
}

/**
 * OrdonnanceWriter
 *
 * French prescription writer compliant with Moroccan medical standards.
 * - Uses DCI (generic) names
 * - Proper posologie format
 * - A5 print-ready layout
 * - Can send PDF via WhatsApp
 */
export function OrdonnanceWriter({
  doctorName,
  doctorSpecialty,
  doctorPhone,
  clinicName,
  clinicAddress,
  clinicCity,
  orderNumber,
  patients,
  onSendWhatsApp,
}: OrdonnanceWriterProps) {
  const [selectedPatient, setSelectedPatient] = useState(patients[0]?.id ?? "");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medications, setMedications] = useState<OrdonnanceMedication[]>([
    { dci: "", forme: "Comprimé", dosage: "", posologie: "", duree: "" },
  ]);

  const patient = patients.find((p) => p.id === selectedPatient);

  const addMedication = () => {
    setMedications([
      ...medications,
      { dci: "", forme: "Comprimé", dosage: "", posologie: "", duree: "" },
    ]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (
    index: number,
    field: keyof OrdonnanceMedication,
    value: string
  ) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const buildOrdonnance = (): OrdonnanceData => ({
    doctorName,
    doctorSpecialty,
    doctorPhone,
    clinicName,
    clinicAddress,
    clinicCity,
    orderNumber,
    patientName: patient?.name ?? "",
    patientAge: patient?.age,
    date: new Date().toISOString().split("T")[0],
    diagnosis,
    medications,
    notes,
  });

  const handlePrint = () => {
    const ordonnance = buildOrdonnance();
    const html = generateOrdonnanceHTML(ordonnance);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSendWhatsApp = () => {
    onSendWhatsApp?.(buildOrdonnance());
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ordonnance Médicale</CardTitle>
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
                    {p.name} {p.age ? `(${p.age} ans)` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Diagnostic</Label>
              <Input
                placeholder="Ex: Angine bactérienne, Hypertension artérielle..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Médicaments (DCI)</CardTitle>
            <Button variant="outline" size="sm" onClick={addMedication}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {medications.map((med, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Rp/ {index + 1}</Badge>
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
                  <div className="space-y-2">
                    <Label>DCI (Nom générique) *</Label>
                    <Input
                      placeholder="Ex: Amoxicilline"
                      value={med.dci}
                      onChange={(e) => updateMedication(index, "dci", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom commercial (optionnel)</Label>
                    <Input
                      placeholder="Ex: Clamoxyl"
                      value={med.brandName ?? ""}
                      onChange={(e) => updateMedication(index, "brandName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Forme</Label>
                    <select
                      value={med.forme}
                      onChange={(e) => updateMedication(index, "forme", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {FORMES_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dosage</Label>
                    <Input
                      placeholder="Ex: 500mg, 1g"
                      value={med.dosage}
                      onChange={(e) => updateMedication(index, "dosage", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posologie *</Label>
                    <Input
                      placeholder="Ex: 1 cp x 3/jour après les repas"
                      value={med.posologie}
                      onChange={(e) => updateMedication(index, "posologie", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Durée *</Label>
                    <Input
                      placeholder="Ex: 7 jours, 1 mois"
                      value={med.duree}
                      onChange={(e) => updateMedication(index, "duree", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Instructions spéciales</Label>
                    <Input
                      placeholder="Ex: À prendre avec un grand verre d'eau, à jeun..."
                      value={med.instructions ?? ""}
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
              <Label>Notes complémentaires</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Conseils hygiéno-diététiques, régime alimentaire, prochaine consultation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer (A5)
              </Button>
              <Button className="flex-1" variant="outline" onClick={handlePrint}>
                <FileDown className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSendWhatsApp}
              >
                <Send className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- HTML Generator for Print ----

function generateOrdonnanceHTML(data: OrdonnanceData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ordonnance - ${escapeHtml(data.patientName)}</title>
  <style>
    @page { size: A5 portrait; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11px; color: #000; padding: 10mm; max-width: 148mm; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .header h1 { font-size: 14px; margin-bottom: 2px; }
    .header .specialty { font-size: 11px; font-style: italic; margin-bottom: 4px; }
    .header .info { font-size: 9px; line-height: 1.5; }
    .header .order-num { font-size: 9px; margin-top: 4px; }
    .patient-info { margin: 10px 0; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
    .patient-info p { font-size: 11px; line-height: 1.6; }
    .date-line { text-align: right; font-size: 10px; margin-bottom: 8px; }
    .ordonnance-title { text-align: center; font-size: 16px; font-weight: bold; text-decoration: underline; margin: 12px 0; letter-spacing: 2px; }
    .medication { margin: 10px 0; padding-left: 15px; }
    .medication .rp { font-weight: bold; font-size: 12px; margin-bottom: 4px; }
    .medication .med-name { font-size: 12px; font-weight: bold; }
    .medication .dci { font-size: 10px; color: #444; font-style: italic; }
    .medication .details { font-size: 11px; margin-left: 20px; line-height: 1.8; }
    .medication .details span { display: block; }
    .notes { margin-top: 15px; padding: 8px; border-top: 1px dashed #999; font-size: 10px; font-style: italic; }
    .signature { margin-top: 30px; text-align: right; }
    .signature p { font-size: 10px; }
    .signature .line { margin-top: 25px; border-top: 1px solid #000; width: 120px; margin-left: auto; }
    .footer { position: fixed; bottom: 10mm; left: 10mm; right: 10mm; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #eee; padding-top: 5px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(data.doctorName)}</h1>
    <div class="specialty">${escapeHtml(data.doctorSpecialty)}</div>
    <div class="info">
      ${escapeHtml(data.clinicName)}<br>
      ${escapeHtml(data.clinicAddress)}, ${escapeHtml(data.clinicCity)}<br>
      Tél: ${escapeHtml(data.doctorPhone)}
    </div>
    <div class="order-num">N° Ordre: ${escapeHtml(data.orderNumber)}</div>
  </div>

  <div class="date-line">${escapeHtml(data.clinicCity)}, le ${formatDate(data.date)}</div>

  <div class="patient-info">
    <p><strong>Patient(e):</strong> ${escapeHtml(data.patientName)}</p>
    ${data.patientAge ? `<p><strong>Âge:</strong> ${data.patientAge} ans</p>` : ""}
    ${data.patientWeight ? `<p><strong>Poids:</strong> ${escapeHtml(data.patientWeight)}</p>` : ""}
  </div>

  <div class="ordonnance-title">ORDONNANCE</div>

  ${data.medications
    .map(
      (med, i) => `
  <div class="medication">
    <div class="rp">Rp/ ${i + 1}</div>
    <div class="med-name">${escapeHtml(med.dci)} ${escapeHtml(med.dosage)} — ${escapeHtml(med.forme)}</div>
    ${med.brandName ? `<div class="dci">(${escapeHtml(med.brandName)})</div>` : ""}
    <div class="details">
      <span><strong>Posologie:</strong> ${escapeHtml(med.posologie)}</span>
      <span><strong>Durée:</strong> ${escapeHtml(med.duree)}</span>
      ${med.quantite ? `<span><strong>Qté:</strong> ${escapeHtml(med.quantite)}</span>` : ""}
      ${med.instructions ? `<span><em>${escapeHtml(med.instructions)}</em></span>` : ""}
    </div>
  </div>`
    )
    .join("\n")}

  ${data.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(data.notes)}</div>` : ""}
  ${data.diagnosis ? `<div class="notes"><strong>Diagnostic:</strong> ${escapeHtml(data.diagnosis)}</div>` : ""}

  <div class="signature">
    <p>Cachet et signature</p>
    <div class="line"></div>
    <p style="margin-top: 5px;">${escapeHtml(data.doctorName)}</p>
  </div>

  <div class="footer">
    ${escapeHtml(data.clinicName)} — ${escapeHtml(data.clinicAddress)}, ${escapeHtml(data.clinicCity)} — Tél: ${escapeHtml(data.doctorPhone)}
  </div>
</body>
</html>`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("fr-MA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
