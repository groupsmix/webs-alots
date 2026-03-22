"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Activity, AlertTriangle } from "lucide-react";
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
  fetchIopMeasurements,
  createIopMeasurement,
  fetchPatients,
  type IopMeasurementView,
  type PatientView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

const METHODS = [
  { value: "goldmann", label: "Goldmann Applanation" },
  { value: "non_contact", label: "Non-Contact (Air Puff)" },
  { value: "tonopen", label: "Tonopen" },
  { value: "icare", label: "iCare" },
  { value: "other", label: "Other" },
];

function getPressureStatus(pressure: number): { label: string; color: string } {
  if (pressure <= 10) return { label: "Low", color: "text-blue-500" };
  if (pressure <= 21) return { label: "Normal", color: "text-green-500" };
  if (pressure <= 24) return { label: "Borderline", color: "text-yellow-500" };
  return { label: "High", color: "text-red-500" };
}

export default function IopTrackingPage() {
  const [measurements, setMeasurements] = useState<IopMeasurementView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    measuredAt: new Date().toISOString().split("T")[0],
    odPressure: "",
    osPressure: "",
    method: "goldmann",
    notes: "",
  });

  const load = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [m, p] = await Promise.all([
      fetchIopMeasurements(user.clinic_id, selectedPatient || undefined),
      fetchPatients(user.clinic_id),
    ]);
    setMeasurements(m);
    setPatients(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedPatient]);

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    await createIopMeasurement({
      clinic_id: user.clinic_id,
      patient_id: form.patientId,
      doctor_id: user.id,
      measured_at: form.measuredAt,
      od_pressure: parseFloat(form.odPressure),
      os_pressure: parseFloat(form.osPressure),
      method: form.method || undefined,
      notes: form.notes || undefined,
    });
    setShowAdd(false);
    setForm({ patientId: "", measuredAt: new Date().toISOString().split("T")[0], odPressure: "", osPressure: "", method: "goldmann", notes: "" });
    load();
  };

  if (loading) {
    return <PageLoader message="Loading IOP measurements..." />;
  }

  // Group by patient for history chart
  const byPatient = new Map<string, IopMeasurementView[]>();
  for (const m of measurements) {
    const arr = byPatient.get(m.patientId) ?? [];
    arr.push(m);
    byPatient.set(m.patientId, arr);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Intraocular Pressure (IOP)</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Measurement
        </Button>
      </div>

      {/* Patient filter */}
      <div className="mb-6 max-w-xs">
        <Select value={selectedPatient} onValueChange={(v) => setSelectedPatient(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="All patients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All patients</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {measurements.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No IOP measurements recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(byPatient.entries()).map(([patientId, data]) => {
            const latest = data[data.length - 1];
            const odStatus = getPressureStatus(latest.odPressure);
            const osStatus = getPressureStatus(latest.osPressure);
            const hasHighPressure = data.some((m) => m.odPressure > 21 || m.osPressure > 21);

            return (
              <Card key={patientId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {data[0].patientName}
                      {hasHighPressure && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Latest: {latest.measuredAt}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Latest readings */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
                      <p className="text-xs text-muted-foreground">OD (Right)</p>
                      <p className="text-3xl font-bold">{latest.odPressure}</p>
                      <p className="text-xs">mmHg</p>
                      <Badge variant={latest.odPressure > 21 ? "destructive" : "success"} className="mt-1">
                        {odStatus.label}
                      </Badge>
                    </div>
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                      <p className="text-xs text-muted-foreground">OS (Left)</p>
                      <p className="text-3xl font-bold">{latest.osPressure}</p>
                      <p className="text-xs">mmHg</p>
                      <Badge variant={latest.osPressure > 21 ? "destructive" : "success"} className="mt-1">
                        {osStatus.label}
                      </Badge>
                    </div>
                  </div>

                  {/* History chart (text-based) */}
                  {data.length > 1 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium mb-2">Pressure History</p>
                      <div className="relative">
                        {/* Reference lines */}
                        <div className="absolute left-0 right-0 top-0 h-full flex flex-col justify-between pointer-events-none">
                          <div className="border-b border-dashed border-red-300 dark:border-red-800 relative">
                            <span className="absolute -top-3 right-0 text-[10px] text-red-400">21 mmHg</span>
                          </div>
                          <div className="border-b border-dashed border-green-300 dark:border-green-800 relative">
                            <span className="absolute -top-3 right-0 text-[10px] text-green-400">10 mmHg</span>
                          </div>
                        </div>

                        {/* Data points */}
                        <div className="flex items-end gap-1 h-32 pt-4 pb-2">
                          {data.map((m) => {
                            const maxP = 35;
                            const odH = Math.min((m.odPressure / maxP) * 100, 100);
                            const osH = Math.min((m.osPressure / maxP) * 100, 100);
                            return (
                              <div key={m.id} className="flex-1 flex gap-[2px] items-end" title={`${m.measuredAt}: OD=${m.odPressure} OS=${m.osPressure}`}>
                                <div
                                  className={`flex-1 rounded-t ${m.odPressure > 21 ? "bg-red-400" : "bg-blue-400"}`}
                                  style={{ height: `${odH}%` }}
                                />
                                <div
                                  className={`flex-1 rounded-t ${m.osPressure > 21 ? "bg-red-400" : "bg-green-400"}`}
                                  style={{ height: `${osH}%` }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {data.map((m) => (
                            <div key={m.id} className="flex-1 text-center">
                              <p className="text-[9px] text-muted-foreground truncate">{m.measuredAt.slice(5)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-4 mt-2 justify-center">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-blue-400" />
                          <span className="text-[10px] text-muted-foreground">OD</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-green-400" />
                          <span className="text-[10px] text-muted-foreground">OS</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* History table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">OD</th>
                          <th className="py-2 pr-3">OS</th>
                          <th className="py-2 pr-3">Method</th>
                          <th className="py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...data].reverse().map((m) => (
                          <tr key={m.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">{m.measuredAt}</td>
                            <td className={`py-2 pr-3 font-medium ${getPressureStatus(m.odPressure).color}`}>
                              {m.odPressure} mmHg
                            </td>
                            <td className={`py-2 pr-3 font-medium ${getPressureStatus(m.osPressure).color}`}>
                              {m.osPressure} mmHg
                            </td>
                            <td className="py-2 pr-3 capitalize">{m.method.replace(/_/g, " ")}</td>
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

      {/* New Measurement Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Record IOP Measurement
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
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm((p) => ({ ...p, method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>OD Pressure (mmHg)</Label>
                <Input type="number" step="0.5" min="0" max="60" value={form.odPressure} onChange={(e) => setForm((p) => ({ ...p, odPressure: e.target.value }))} placeholder="e.g., 16" />
              </div>
              <div className="space-y-2">
                <Label>OS Pressure (mmHg)</Label>
                <Input type="number" step="0.5" min="0" max="60" value={form.osPressure} onChange={(e) => setForm((p) => ({ ...p, osPressure: e.target.value }))} placeholder="e.g., 15" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Clinical observations..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.patientId || !form.odPressure || !form.osPressure}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
