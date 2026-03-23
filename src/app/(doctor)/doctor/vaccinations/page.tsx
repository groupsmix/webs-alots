"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Syringe, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
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
  fetchVaccinations,
  createVaccination,
  updateVaccination,
  fetchPatients,
  type VaccinationView,
  type PatientView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

const COMMON_VACCINES = [
  "BCG", "Hepatitis B", "DTP (Diphtheria-Tetanus-Pertussis)",
  "Polio (IPV)", "Polio (OPV)", "Hib", "PCV13",
  "Rotavirus", "MMR", "Varicella", "Hepatitis A",
  "Meningococcal", "HPV", "Influenza", "COVID-19",
];

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; variant: "default" | "success" | "warning" | "destructive"; label: string }> = {
  scheduled: { icon: Clock, variant: "default", label: "Scheduled" },
  administered: { icon: CheckCircle, variant: "success", label: "Administered" },
  overdue: { icon: AlertTriangle, variant: "destructive", label: "Overdue" },
  skipped: { icon: XCircle, variant: "warning", label: "Skipped" },
};

export default function VaccinationsPage() {
  const [vaccinations, setVaccinations] = useState<VaccinationView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    vaccineName: "",
    doseNumber: "1",
    scheduledDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const fetchData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return null;
    const [v, p] = await Promise.all([
      fetchVaccinations(user.clinic_id, selectedPatient || undefined),
      fetchPatients(user.clinic_id),
    ]);
    // Auto-mark overdue
    const today = new Date().toISOString().split("T")[0];
    const vaccinations = v.map((vac) => {
      if (vac.status === "scheduled" && vac.scheduledDate < today) {
        return { ...vac, status: "overdue" as const };
      }
      return vac;
    });
    return { vaccinations, patients: p };
  }, [selectedPatient]);

  useEffect(() => {
    let cancelled = false;
    fetchData().then((result) => {
      if (cancelled) return;
      if (result) {
        setVaccinations(result.vaccinations);
        setPatients(result.patients);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchData]);

  const reload = async () => {
    const result = await fetchData();
    if (result) {
      setVaccinations(result.vaccinations);
      setPatients(result.patients);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    await createVaccination({
      clinic_id: user.clinic_id,
      patient_id: form.patientId,
      doctor_id: user.id,
      vaccine_name: form.vaccineName,
      dose_number: parseInt(form.doseNumber) || 1,
      scheduled_date: form.scheduledDate,
      notes: form.notes || undefined,
    });
    setShowAdd(false);
    setForm({ patientId: "", vaccineName: "", doseNumber: "1", scheduledDate: new Date().toISOString().split("T")[0], notes: "" });
    reload();
  };

  const handleAdminister = async (id: string) => {
    await updateVaccination(id, {
      status: "administered",
      administered_date: new Date().toISOString().split("T")[0],
    });
    reload();
  };

  const handleSkip = async (id: string) => {
    await updateVaccination(id, { status: "skipped" });
    reload();
  };

  if (loading) {
    return <PageLoader message="Loading vaccination records..." />;
  }

  const overdue = vaccinations.filter((v) => v.status === "overdue");
  const upcoming = vaccinations.filter((v) => v.status === "scheduled");
  const administered = vaccinations.filter((v) => v.status === "administered");
  const skipped = vaccinations.filter((v) => v.status === "skipped");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Vaccination Tracking</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Schedule Vaccine
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

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{overdue.length}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{upcoming.length}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{administered.length}</p>
            <p className="text-xs text-muted-foreground">Administered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <XCircle className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{skipped.length}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Overdue Vaccinations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdue.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                  <div>
                    <p className="text-sm font-medium">{v.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.vaccineName} (Dose {v.doseNumber}) — Due: {v.scheduledDate}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleAdminister(v.id)}>
                      <Syringe className="h-3 w-3 mr-1" /> Administer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleSkip(v.id)}>Skip</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All vaccinations list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Vaccinations</CardTitle>
        </CardHeader>
        <CardContent>
          {vaccinations.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No vaccination records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Patient</th>
                    <th className="py-2 pr-3">Vaccine</th>
                    <th className="py-2 pr-3">Dose</th>
                    <th className="py-2 pr-3">Scheduled</th>
                    <th className="py-2 pr-3">Administered</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vaccinations.map((v) => {
                    const cfg = statusConfig[v.status];
                    return (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{v.patientName}</td>
                        <td className="py-2 pr-3">{v.vaccineName}</td>
                        <td className="py-2 pr-3">{v.doseNumber}</td>
                        <td className="py-2 pr-3">{v.scheduledDate}</td>
                        <td className="py-2 pr-3">{v.administeredDate ?? "—"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </td>
                        <td className="py-2">
                          {(v.status === "scheduled" || v.status === "overdue") && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleAdminister(v.id)}>
                                <Syringe className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleSkip(v.id)}>
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Vaccine Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5" /> Schedule Vaccination
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
            <div className="space-y-2">
              <Label>Vaccine</Label>
              <Select value={form.vaccineName} onValueChange={(v) => setForm((p) => ({ ...p, vaccineName: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vaccine" /></SelectTrigger>
                <SelectContent>
                  {COMMON_VACCINES.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dose Number</Label>
                <Input type="number" min="1" value={form.doseNumber} onChange={(e) => setForm((p) => ({ ...p, doseNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Scheduled Date</Label>
                <Input type="date" value={form.scheduledDate} onChange={(e) => setForm((p) => ({ ...p, scheduledDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.patientId || !form.vaccineName}>Schedule</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
