"use client";

import { useState, useEffect } from "react";
import { Plus, Download, Pill, Trash2, Save, FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getCurrentUser,
  fetchPrescriptions,
  fetchPatients,
  createPrescription,
  type PrescriptionView,
  type PatientView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

type Prescription = PrescriptionView;

interface MedicationEntry {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

function generatePrescriptionPDF(rx: Prescription) {
  const lineHeight = 20;
  let y = 60;

  const lines: string[] = [];
  const addLine = (text: string, fontSize: number = 12, bold: boolean = false) => {
    const weight = bold ? "bold" : "normal";
    lines.push(
      `<text x="40" y="${y}" font-size="${fontSize}" font-weight="${weight}" font-family="Helvetica, Arial, sans-serif">${escapeXml(text)}</text>`
    );
    y += lineHeight + (fontSize > 12 ? 8 : 2);
  };

  const escapeXml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  addLine("PRESCRIPTION", 20, true);
  y += 5;
  addLine(`Doctor: ${rx.doctorName}`, 12, true);
  addLine(`Patient: ${rx.patientName}`);
  addLine(`Date: ${rx.date}`);
  y += 10;

  lines.push(`<line x1="40" y1="${y}" x2="560" y2="${y}" stroke="#ccc" stroke-width="1" />`);
  y += 15;

  addLine("Medications:", 14, true);
  y += 5;

  rx.medications.forEach((med, i) => {
    addLine(`${i + 1}. ${med.name}`, 12, true);
    addLine(`   Dosage: ${med.dosage}`);
    addLine(`   Duration: ${med.duration}`);
    y += 5;
  });

  if (rx.notes) {
    y += 10;
    addLine("Notes:", 12, true);
    addLine(rx.notes);
  }

  y += 40;
  lines.push(`<line x1="350" y1="${y}" x2="540" y2="${y}" stroke="#333" stroke-width="1" />`);
  y += 15;
  addLine("Doctor's Signature");

  const pageHeight = Math.max(y + 60, 600);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${pageHeight}" viewBox="0 0 600 ${pageHeight}">
  <rect width="600" height="${pageHeight}" fill="white"/>
  <rect x="20" y="20" width="560" height="${pageHeight - 40}" fill="none" stroke="#e0e0e0" stroke-width="1" rx="4"/>
  ${lines.join("\n  ")}
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prescription-${rx.patientName.replace(/\s+/g, "-").toLowerCase()}-${rx.date}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DoctorPrescriptionsPage() {
  const [rxList, setRxList] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [showWriter, setShowWriter] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medications, setMedications] = useState<MedicationEntry[]>([
    { name: "", dosage: "", frequency: "", duration: "", instructions: "" },
  ]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const [rxs, pts] = await Promise.all([
      fetchPrescriptions(user.clinic_id),
      fetchPatients(user.clinic_id),
    ]);
      if (controller.signal.aborted) return;
    setRxList(rxs);
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

  if (loading) {
    return <PageLoader message="Loading prescriptions..." />;
  }

  const addMedication = () => {
    setMedications([
      ...medications,
      { name: "", dosage: "", frequency: "", duration: "", instructions: "" },
    ]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof MedicationEntry, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleSavePrescription = async () => {
    const patient = patients.find((p) => p.id === selectedPatient);
    if (!patient) return;
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;

    const items = medications
      .filter((m) => m.name.trim())
      .map((m) => ({ name: m.name, dosage: `${m.dosage} ${m.frequency}`.trim(), duration: m.duration }));

    const ok = await createPrescription({
      clinic_id: user.clinic_id,
      doctor_id: user.id,
      patient_id: patient.id,
      items,
      notes: notes || undefined,
    });

    if (ok) {
      const newRx: Prescription = {
        id: `rx-${Date.now()}`,
        patientId: patient.id,
        patientName: patient.name,
        doctorName: user.name ?? "Doctor",
        date: new Date().toISOString().split("T")[0],
        medications: items,
        notes: notes || undefined,
      };
      setRxList((prev) => [newRx, ...prev]);
    }
    setShowWriter(false);
    setMedications([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
    setDiagnosis("");
    setNotes("");
  };

  const handleSaveAndDownload = async () => {
    const patient = patients.find((p) => p.id === selectedPatient);
    if (!patient) return;
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;

    const items = medications
      .filter((m) => m.name.trim())
      .map((m) => ({ name: m.name, dosage: `${m.dosage} ${m.frequency}`.trim(), duration: m.duration }));

    const ok = await createPrescription({
      clinic_id: user.clinic_id,
      doctor_id: user.id,
      patient_id: patient.id,
      items,
      notes: notes || undefined,
    });

    const newRx: Prescription = {
      id: `rx-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      doctorName: user.name ?? "Doctor",
      date: new Date().toISOString().split("T")[0],
      medications: items,
      notes: notes || undefined,
    };

    if (ok) {
      setRxList((prev) => [newRx, ...prev]);
    }
    generatePrescriptionPDF(newRx);
    setShowWriter(false);
    setMedications([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
    setDiagnosis("");
    setNotes("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        <Button onClick={() => setShowWriter(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Prescription
        </Button>
      </div>

      <div className="space-y-4">
        {rxList.map((rx) => (
          <Card key={rx.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4 text-primary" />
                  {rx.patientName}
                </CardTitle>
                <Badge variant="outline">{rx.date}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border p-3 mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-medium pb-2">Medication</th>
                      <th className="text-left font-medium pb-2">Dosage</th>
                      <th className="text-left font-medium pb-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rx.medications.map((med, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-2">{med.name}</td>
                        <td className="py-2 text-muted-foreground">{med.dosage}</td>
                        <td className="py-2 text-muted-foreground">{med.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rx.notes && <p className="text-xs text-muted-foreground mb-3">Notes: {rx.notes}</p>}
              <Button variant="outline" size="sm" onClick={() => generatePrescriptionPDF(rx)}>
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Prescription Writer Dialog */}
      <Dialog open={showWriter} onOpenChange={setShowWriter}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto" onClose={() => setShowWriter(false)}>
          <DialogHeader>
            <DialogTitle>New Prescription</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Patient</Label>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Diagnosis</Label>
                <Input
                  placeholder="Enter diagnosis..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>
            </div>

            {/* Medications */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Medications</Label>
                <Button variant="outline" size="sm" onClick={addMedication}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-4">
                {medications.map((med, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Medication {index + 1}</Badge>
                      {medications.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeMedication(index)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input placeholder="e.g., Amoxicillin" value={med.name} onChange={(e) => updateMedication(index, "name", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Dosage</Label>
                        <Input placeholder="e.g., 500mg" value={med.dosage} onChange={(e) => updateMedication(index, "dosage", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Frequency</Label>
                        <Input placeholder="e.g., 3x/day" value={med.frequency} onChange={(e) => updateMedication(index, "frequency", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Duration</Label>
                        <Input placeholder="e.g., 7 days" value={med.duration} onChange={(e) => updateMedication(index, "duration", e.target.value)} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Instructions</Label>
                        <Input placeholder="e.g., Take with food" value={med.instructions} onChange={(e) => updateMedication(index, "instructions", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowWriter(false)}>Cancel</Button>
              <Button variant="outline" onClick={handleSavePrescription}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button onClick={handleSaveAndDownload}>
                <FileDown className="h-4 w-4 mr-1" />
                Save &amp; Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
