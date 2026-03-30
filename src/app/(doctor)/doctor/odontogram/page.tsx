"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OdontogramChart } from "@/components/dental/odontogram-chart";
import { getCurrentUser, fetchPatients, fetchOdontogram, upsertOdontogramEntry, type PatientView, type OdontogramView } from "@/lib/data/client";
import type { ToothStatus, OdontogramEntry } from "@/lib/types/dental";
import { PageLoader } from "@/components/ui/page-loader";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DoctorOdontogramPage() {
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [entries, setEntries] = useState<OdontogramView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPatients() {
      const user = await getCurrentUser();
      if (!user?.clinic_id) { setLoading(false); return; }
      const pts = await fetchPatients(user.clinic_id);
      setPatients(pts);
      if (pts.length > 0) {
        setSelectedPatient(pts[0].id);
        const data = await fetchOdontogram(user.clinic_id, pts[0].id);
        setEntries(data);
      }
      setLoading(false);
    }
    loadPatients();
    return () => { controller.abort(); };
  }, []);

  useEffect(() => {
    async function loadOdontogram() {
      if (!selectedPatient) return;
      const user = await getCurrentUser();
      if (!user?.clinic_id) return;
      const data = await fetchOdontogram(user.clinic_id, selectedPatient);
      setEntries(data);
    }
    loadOdontogram();
  }, [selectedPatient]);

  if (loading) {
    return <PageLoader message="Loading odontogram..." />;
  }

  const handleUpdateEntry = async (toothNumber: number, status: ToothStatus, notes: string) => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !selectedPatient) return;

    const dentition: "adult" | "child" = toothNumber >= 51 && toothNumber <= 85 ? "child" : "adult";

    await upsertOdontogramEntry({
      clinic_id: user.clinic_id,
      patient_id: selectedPatient,
      tooth_number: toothNumber,
      status,
      notes,
      dentition,
    });

    const newEntry: OdontogramView = {
      toothNumber,
      status,
      notes,
      lastUpdated: new Date().toISOString().split("T")[0],
    };
    setEntries((prev) => {
      const existingIdx = prev.findIndex((e) => e.toothNumber === toothNumber);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newEntry;
        return updated;
      }
      return [...prev, newEntry];
    });
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Odontogram" }]} />
      <h1 className="text-2xl font-bold">Odontogram Editor</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Select Patient</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs text-muted-foreground">Patient</Label>
          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            className="w-full rounded-lg border p-2 text-sm bg-background mt-1"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {entries.length > 0 ? (
        <OdontogramChart
          entries={entries.map(e => ({ toothNumber: e.toothNumber, status: e.status as OdontogramEntry["status"], notes: e.notes ?? "", lastUpdated: e.lastUpdated ?? "" }))}
          editable
          onUpdateEntry={handleUpdateEntry}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No odontogram entries for this patient.</p>
      )}
    </div>
  );
}
