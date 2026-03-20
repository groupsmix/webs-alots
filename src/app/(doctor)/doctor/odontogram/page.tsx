"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OdontogramChart } from "@/components/dental/odontogram-chart";
import { patientOdontograms, type ToothStatus, type OdontogramEntry } from "@/lib/dental-demo-data";

export default function DoctorOdontogramPage() {
  const [selectedPatient, setSelectedPatient] = useState(patientOdontograms[0]?.patientId ?? "");
  const [odontograms, setOdontograms] = useState(patientOdontograms);

  const current = odontograms.find((o) => o.patientId === selectedPatient);

  const handleUpdateEntry = (toothNumber: number, status: ToothStatus, notes: string) => {
    setOdontograms((prev) =>
      prev.map((o) => {
        if (o.patientId !== selectedPatient) return o;
        const existingIdx = o.entries.findIndex((e) => e.toothNumber === toothNumber);
        const newEntry: OdontogramEntry = {
          toothNumber,
          status,
          notes,
          lastUpdated: new Date().toISOString().split("T")[0],
        };
        const entries = [...o.entries];
        if (existingIdx >= 0) {
          entries[existingIdx] = newEntry;
        } else {
          entries.push(newEntry);
        }
        return { ...o, entries };
      })
    );
  };

  return (
    <div className="space-y-6">
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
            {odontograms.map((o) => (
              <option key={o.patientId} value={o.patientId}>{o.patientName}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {current && (
        <OdontogramChart
          entries={current.entries}
          editable
          onUpdateEntry={handleUpdateEntry}
        />
      )}
    </div>
  );
}
