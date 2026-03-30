"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, FileDown, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentUser,
  fetchPatients,
  type PatientView,
} from "@/lib/data/client";
import { downloadPrescriptionPDF } from "@/lib/prescription-pdf";
import { PageLoader } from "@/components/ui/page-loader";
import { DrugSearch, type DrugSelection } from "@/components/prescription/drug-search";
import { generatePrescriptionNumber } from "@/lib/prescription-id";
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

/**
 * PrescriptionWriter
 *
 * Form to create prescriptions for a patient.
 * Features:
 * - DCI drug search/autocomplete
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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [doctorName, setDoctorName] = useState("");
  const [doctorINPE, setDoctorINPE] = useState("");
  const [clinicName, setClinicName] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }

      // Extract doctor info from the current user
      setDoctorName(user.name ?? "");
      const meta = (user as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
      if (meta?.inpe_number) {
        setDoctorINPE(meta.inpe_number as string);
      }
      setClinicName((user as unknown as Record<string, unknown>).clinic_name as string ?? "");

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

  const patient = patients.find((p) => p.id === selectedPatient) ?? patients[0];

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
    <div className="space-y-4">
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Diagnosis</Label>
              <Input
                placeholder="Enter diagnosis..."
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
            <CardTitle className="text-base">Medications</CardTitle>
            <Button variant="outline" size="sm" onClick={addMedication}>
              <Plus className="h-4 w-4 mr-1" />
              Add Medication
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {medications.map((med, index) => (
              <div key={med._id} className="border rounded-lg p-4 space-y-3">
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
  );
}
