"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Heart, Calendar, AlertTriangle } from "lucide-react";
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
  fetchPregnancies,
  createPregnancy,
  updatePregnancy,
  fetchPatients,
  type PregnancyView,
  type PatientView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function PregnanciesPage() {
  const [pregnancies, setPregnancies] = useState<PregnancyView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    lmpDate: "",
    gravida: "",
    para: "",
    bloodType: "",
    rhFactor: "",
    notes: "",
  });
  const [birthPlanForm, setBirthPlanForm] = useState({
    id: "",
    birthPlanNotes: "",
    deliveryType: "",
  });
  const [showBirthPlan, setShowBirthPlan] = useState(false);

  const load = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [preg, p] = await Promise.all([
      fetchPregnancies(user.clinic_id, selectedPatient || undefined),
      fetchPatients(user.clinic_id),
    ]);
    setPregnancies(preg);
    setPatients(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient]);

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const edd = addDays(form.lmpDate, 280); // Naegele's rule
    await createPregnancy({
      clinic_id: user.clinic_id,
      patient_id: form.patientId,
      doctor_id: user.id,
      lmp_date: form.lmpDate,
      edd_date: edd,
      gravida: parseInt(form.gravida) || undefined,
      para: parseInt(form.para) || undefined,
      blood_type: form.bloodType || undefined,
      rh_factor: form.rhFactor || undefined,
      notes: form.notes || undefined,
    });
    setShowAdd(false);
    setForm({ patientId: "", lmpDate: "", gravida: "", para: "", bloodType: "", rhFactor: "", notes: "" });
    load();
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    await updatePregnancy(id, { status });
    load();
  };

  const handleSaveBirthPlan = async () => {
    await updatePregnancy(birthPlanForm.id, {
      birth_plan_notes: birthPlanForm.birthPlanNotes,
      delivery_type: birthPlanForm.deliveryType || null,
    });
    setShowBirthPlan(false);
    load();
  };

  const openBirthPlan = (p: PregnancyView) => {
    setBirthPlanForm({
      id: p.id,
      birthPlanNotes: p.birthPlanNotes,
      deliveryType: p.deliveryType ?? "",
    });
    setShowBirthPlan(true);
  };

  if (loading) {
    return <PageLoader message="Loading pregnancy records..." />;
  }

  const active = pregnancies.filter((p) => p.status === "active");
  const completed = pregnancies.filter((p) => p.status !== "active");

  const trimesterLabel = (t: number) => t === 1 ? "1st Trimester" : t === 2 ? "2nd Trimester" : "3rd Trimester";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Pregnancy Tracking</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Pregnancy
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

      {/* Active pregnancies */}
      {active.length > 0 && (
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold">Active Pregnancies</h2>
          {active.map((p) => {
            const progress = Math.min((p.gestationalWeeks / 40) * 100, 100);
            return (
              <Card key={p.id} className="border-pink-200 dark:border-pink-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Heart className="h-4 w-4 text-pink-500" />
                      {p.patientName}
                    </CardTitle>
                    <Badge variant="success">{trimesterLabel(p.trimester)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Gestational Age</p>
                      <p className="text-lg font-semibold">{p.gestationalWeeks}w {p.gestationalDays}d</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">EDD</p>
                      <p className="text-sm font-medium">{p.eddDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">LMP</p>
                      <p className="text-sm font-medium">{p.lmpDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">G/P</p>
                      <p className="text-sm font-medium">G{p.gravida ?? "?"} P{p.para ?? "?"}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Week {p.gestationalWeeks}</span>
                      <span>Week 40</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-pink-500 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {p.bloodType && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Blood: {p.bloodType} {p.rhFactor && `(Rh ${p.rhFactor})`}
                    </p>
                  )}

                  {p.riskFactors.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                      {p.riskFactors.map((rf, i) => (
                        <Badge key={i} variant="warning" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" /> {rf}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openBirthPlan(p)}>
                      <Calendar className="h-3 w-3 mr-1" /> Birth Plan
                    </Button>
                    <Select
                      value=""
                      onValueChange={(v) => handleStatusUpdate(p.id, v)}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="Update status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="miscarriage">Miscarriage</SelectItem>
                        <SelectItem value="ectopic">Ectopic</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed pregnancies */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Past Pregnancies</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3">Patient</th>
                      <th className="py-2 pr-3">LMP</th>
                      <th className="py-2 pr-3">EDD</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Delivery</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completed.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{p.patientName}</td>
                        <td className="py-2 pr-3">{p.lmpDate}</td>
                        <td className="py-2 pr-3">{p.eddDate}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={p.status === "delivered" ? "success" : "destructive"}>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          {p.deliveryDate ?? "—"} {p.deliveryType && `(${p.deliveryType})`}
                        </td>
                        <td className="py-2 text-muted-foreground">{p.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {pregnancies.length === 0 && (
        <p className="text-center text-muted-foreground py-10">No pregnancy records yet.</p>
      )}

      {/* New Pregnancy Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" /> New Pregnancy Record
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
              <Label>Last Menstrual Period (LMP)</Label>
              <Input type="date" value={form.lmpDate} onChange={(e) => setForm((p) => ({ ...p, lmpDate: e.target.value }))} />
              {form.lmpDate && (
                <p className="text-xs text-muted-foreground">
                  Estimated Due Date: {addDays(form.lmpDate, 280)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gravida</Label>
                <Input type="number" min="1" value={form.gravida} onChange={(e) => setForm((p) => ({ ...p, gravida: e.target.value }))} placeholder="G?" />
              </div>
              <div className="space-y-2">
                <Label>Para</Label>
                <Input type="number" min="0" value={form.para} onChange={(e) => setForm((p) => ({ ...p, para: e.target.value }))} placeholder="P?" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Blood Type</Label>
                <Select value={form.bloodType} onValueChange={(v) => setForm((p) => ({ ...p, bloodType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["A", "B", "AB", "O"].map((bt) => (
                      <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rh Factor</Label>
                <Select value={form.rhFactor} onValueChange={(v) => setForm((p) => ({ ...p, rhFactor: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positive (+)</SelectItem>
                    <SelectItem value="negative">Negative (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Risk factors, observations..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.patientId || !form.lmpDate}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Birth Plan Dialog */}
      <Dialog open={showBirthPlan} onOpenChange={setShowBirthPlan}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Birth Planning Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Preferred Delivery Type</Label>
              <Select value={birthPlanForm.deliveryType} onValueChange={(v) => setBirthPlanForm((p) => ({ ...p, deliveryType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select preference" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vaginal">Vaginal</SelectItem>
                  <SelectItem value="cesarean">Cesarean</SelectItem>
                  <SelectItem value="assisted">Assisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Birth Plan Notes</Label>
              <Textarea
                rows={6}
                value={birthPlanForm.birthPlanNotes}
                onChange={(e) => setBirthPlanForm((p) => ({ ...p, birthPlanNotes: e.target.value }))}
                placeholder="Hospital preferences, pain management, special requests..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowBirthPlan(false)}>Cancel</Button>
              <Button onClick={handleSaveBirthPlan}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
