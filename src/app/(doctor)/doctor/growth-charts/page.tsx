"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, TrendingUp, Ruler, Weight, Baby } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCurrentUser,
  fetchGrowthMeasurements,
  createGrowthMeasurement,
  fetchPatients,
  type GrowthMeasurementView,
  type PatientView,
} from "@/lib/data/client";

// WHO Weight-for-age reference data (boys, simplified percentiles: 3rd, 50th, 97th)
const WHO_WEIGHT_BOYS: Record<number, [number, number, number]> = {
  0: [2.5, 3.3, 4.3], 1: [3.4, 4.5, 5.7], 2: [4.3, 5.6, 7.1],
  3: [5.0, 6.4, 8.0], 6: [6.4, 7.9, 9.7], 9: [7.2, 8.9, 10.9],
  12: [7.8, 9.6, 11.8], 18: [8.8, 10.9, 13.4], 24: [9.7, 12.2, 15.1],
  36: [11.3, 14.3, 18.1], 48: [12.7, 16.3, 21.2], 60: [14.1, 18.3, 24.6],
};
const WHO_WEIGHT_GIRLS: Record<number, [number, number, number]> = {
  0: [2.4, 3.2, 4.2], 1: [3.2, 4.2, 5.4], 2: [3.9, 5.1, 6.6],
  3: [4.5, 5.8, 7.5], 6: [5.8, 7.3, 9.2], 9: [6.6, 8.2, 10.4],
  12: [7.0, 8.9, 11.3], 18: [8.0, 10.2, 13.0], 24: [9.0, 11.5, 14.8],
  36: [10.6, 13.9, 17.8], 48: [12.1, 16.1, 21.0], 60: [13.5, 18.2, 24.4],
};

function getPercentileLabel(ageMonths: number, weightKg: number, gender: string): string {
  const ref = gender === "F" ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS;
  const ages = Object.keys(ref).map(Number).sort((a, b) => a - b);
  const closest = ages.reduce((prev, curr) =>
    Math.abs(curr - ageMonths) < Math.abs(prev - ageMonths) ? curr : prev
  );
  const [p3, p50, p97] = ref[closest];
  if (weightKg <= p3) return "< 3rd";
  if (weightKg <= p50) return "3rd–50th";
  if (weightKg <= p97) return "50th–97th";
  return "> 97th";
}

export default function GrowthChartsPage() {
  const [measurements, setMeasurements] = useState<GrowthMeasurementView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    measuredAt: new Date().toISOString().split("T")[0],
    ageMonths: "",
    weightKg: "",
    heightCm: "",
    headCircCm: "",
    notes: "",
  });

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [m, p] = await Promise.all([
      fetchGrowthMeasurements(user.clinic_id, selectedPatient || undefined),
      fetchPatients(user.clinic_id),
    ]);
    setMeasurements(m);
    setPatients(p);
    setLoading(false);
  }
    load();
  }, [selectedPatient]);

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const w = parseFloat(form.weightKg) || undefined;
    const h = parseFloat(form.heightCm) || undefined;
    const bmi = w && h ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : undefined;
    await createGrowthMeasurement({
      clinic_id: user.clinic_id,
      patient_id: form.patientId,
      doctor_id: user.id,
      measured_at: form.measuredAt,
      age_months: parseInt(form.ageMonths) || 0,
      weight_kg: w,
      height_cm: h,
      head_circ_cm: parseFloat(form.headCircCm) || undefined,
      bmi,
      notes: form.notes || undefined,
    });
    setShowAdd(false);
    setForm({ patientId: "", measuredAt: new Date().toISOString().split("T")[0], ageMonths: "", weightKg: "", heightCm: "", headCircCm: "", notes: "" });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading growth data...</p>
      </div>
    );
  }

  // Group by patient
  const byPatient = new Map<string, GrowthMeasurementView[]>();
  for (const m of measurements) {
    const arr = byPatient.get(m.patientId) ?? [];
    arr.push(m);
    byPatient.set(m.patientId, arr);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Growth Charts</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Measurement
        </Button>
      </div>

      {/* Patient filter */}
      <div className="mb-6 max-w-xs">
        <Select value={selectedPatient} onValueChange={(v) => setSelectedPatient(v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="All patients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All patients</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {measurements.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No growth measurements recorded yet.</p>
      ) : (
        <div className="space-y-6">
          {Array.from(byPatient.entries()).map(([patientId, data]) => {
            const patient = patients.find((p) => p.id === patientId);
            const latest = data[data.length - 1];
            return (
              <Card key={patientId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{data[0].patientName}</CardTitle>
                    {latest.weightKg && (
                      <Badge variant="secondary">
                        {getPercentileLabel(latest.ageMonths, latest.weightKg, patient?.gender ?? "M")} percentile
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Simple chart representation */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <Weight className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-lg font-semibold">{latest.weightKg ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Weight (kg)</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <Ruler className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <p className="text-lg font-semibold">{latest.heightCm ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Height (cm)</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                      <TrendingUp className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                      <p className="text-lg font-semibold">{latest.bmi ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">BMI</p>
                    </div>
                  </div>

                  {/* Growth timeline */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Age</th>
                          <th className="py-2 pr-3">Weight</th>
                          <th className="py-2 pr-3">Height</th>
                          <th className="py-2 pr-3">Head</th>
                          <th className="py-2 pr-3">BMI</th>
                          <th className="py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((m) => (
                          <tr key={m.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">{m.measuredAt}</td>
                            <td className="py-2 pr-3">
                              {m.ageMonths < 12
                                ? `${m.ageMonths}m`
                                : `${Math.floor(m.ageMonths / 12)}y ${m.ageMonths % 12}m`}
                            </td>
                            <td className="py-2 pr-3">{m.weightKg ?? "—"} kg</td>
                            <td className="py-2 pr-3">{m.heightCm ?? "—"} cm</td>
                            <td className="py-2 pr-3">{m.headCircCm ?? "—"} cm</td>
                            <td className="py-2 pr-3">{m.bmi ?? "—"}</td>
                            <td className="py-2 text-muted-foreground">{m.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Measurement Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Baby className="h-5 w-5" /> Record Growth Measurement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={form.patientId} onValueChange={(v) => setForm((p) => ({ ...p, patientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.measuredAt} onChange={(e) => setForm((p) => ({ ...p, measuredAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Age (months)</Label>
                <Input type="number" min="0" value={form.ageMonths} onChange={(e) => setForm((p) => ({ ...p, ageMonths: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input type="number" step="0.1" value={form.weightKg} onChange={(e) => setForm((p) => ({ ...p, weightKg: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Height (cm)</Label>
                <Input type="number" step="0.1" value={form.heightCm} onChange={(e) => setForm((p) => ({ ...p, heightCm: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Head circ (cm)</Label>
                <Input type="number" step="0.1" value={form.headCircCm} onChange={(e) => setForm((p) => ({ ...p, headCircCm: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional observations..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.patientId || !form.ageMonths}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
