"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Eye, Glasses } from "lucide-react";
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
  fetchVisionTests,
  createVisionTest,
  fetchPatients,
  type VisionTestView,
  type PatientView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";
import { useOfflineDrafts } from "@/lib/hooks/use-offline-drafts";
import { Breadcrumb } from "@/components/ui/breadcrumb";

function formatRx(sphere: number | null, cylinder: number | null, axis: number | null): string {
  if (sphere === null && cylinder === null) return "—";
  const parts: string[] = [];
  if (sphere !== null) parts.push(`${sphere > 0 ? "+" : ""}${sphere.toFixed(2)} SPH`);
  if (cylinder !== null) parts.push(`${cylinder > 0 ? "+" : ""}${cylinder.toFixed(2)} CYL`);
  if (axis !== null) parts.push(`x ${axis}°`);
  return parts.join(" ");
}

export default function VisionTestsPage() {
  const [tests, setTests] = useState<VisionTestView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setFormRaw] = useState({
    patientId: "",
    testDate: new Date().toISOString().split("T")[0],
    odAcuity: "",
    osAcuity: "",
    odSphere: "",
    odCylinder: "",
    odAxis: "",
    osSphere: "",
    osCylinder: "",
    osAxis: "",
    odAdd: "",
    osAdd: "",
    pdMm: "",
    notes: "",
  });

  // Issue 21: Auto-save draft for clinical form
  const { saveDraft: saveVisionDraft, clearDraft: clearVisionDraft } = useOfflineDrafts<typeof form>("vision-tests-form", { autoSaveMs: 5000 });
  const setForm: typeof setFormRaw = (val) => {
    setFormRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      saveVisionDraft(next);
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return null;
    const [t, p] = await Promise.all([
      fetchVisionTests(user.clinic_id, selectedPatient || undefined),
      fetchPatients(user.clinic_id),
    ]);
    return { tests: t, patients: p };
  }, [selectedPatient]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData()
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result) {
          setTests(result.tests);
          setPatients(result.patients);
        }
      })
      .catch(() => {
        // ignored — component unmounted or fetch failed
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => { controller.abort(); };
  }, [fetchData]);

  const reload = async () => {
    const result = await fetchData();
    if (result) {
      setTests(result.tests);
      setPatients(result.patients);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    await createVisionTest({
      clinic_id: user.clinic_id,
      patient_id: form.patientId,
      doctor_id: user.id,
      test_date: form.testDate,
      od_acuity: form.odAcuity || undefined,
      os_acuity: form.osAcuity || undefined,
      od_sphere: parseFloat(form.odSphere) || undefined,
      od_cylinder: parseFloat(form.odCylinder) || undefined,
      od_axis: parseInt(form.odAxis) || undefined,
      os_sphere: parseFloat(form.osSphere) || undefined,
      os_cylinder: parseFloat(form.osCylinder) || undefined,
      os_axis: parseInt(form.osAxis) || undefined,
      od_add: parseFloat(form.odAdd) || undefined,
      os_add: parseFloat(form.osAdd) || undefined,
      pd_mm: parseFloat(form.pdMm) || undefined,
      notes: form.notes || undefined,
    });
    setShowAdd(false);
    clearVisionDraft();
    setFormRaw({ patientId: "", testDate: new Date().toISOString().split("T")[0], odAcuity: "", osAcuity: "", odSphere: "", odCylinder: "", odAxis: "", osSphere: "", osCylinder: "", osAxis: "", odAdd: "", osAdd: "", pdMm: "", notes: "" });
    reload();
  };

  if (loading) {
    return <PageLoader message="Loading vision test records..." />;
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Vision Tests" }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Vision Tests & Prescriptions</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Vision Test
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

      {tests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Eye className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No vision test records yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tests.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t.patientName}</CardTitle>
                  <p className="text-xs text-muted-foreground">{t.testDate}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Visual Acuity */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Visual Acuity
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <p className="text-xs text-muted-foreground">OD (Right)</p>
                        <p className="text-lg font-semibold">{t.odAcuity || "—"}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                        <p className="text-xs text-muted-foreground">OS (Left)</p>
                        <p className="text-lg font-semibold">{t.osAcuity || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Refraction / Lens Rx */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Glasses className="h-3 w-3" /> Lens Prescription
                    </p>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <p className="text-xs text-muted-foreground">OD (Right)</p>
                        <p className="text-sm font-mono">{formatRx(t.odSphere, t.odCylinder, t.odAxis)}</p>
                        {t.odAdd !== null && <p className="text-xs text-muted-foreground">Add: +{t.odAdd?.toFixed(2)}</p>}
                      </div>
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                        <p className="text-xs text-muted-foreground">OS (Left)</p>
                        <p className="text-sm font-mono">{formatRx(t.osSphere, t.osCylinder, t.osAxis)}</p>
                        {t.osAdd !== null && <p className="text-xs text-muted-foreground">Add: +{t.osAdd?.toFixed(2)}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {t.pdMm !== null && (
                  <div className="mt-3">
                    <Badge variant="secondary">PD: {t.pdMm} mm</Badge>
                  </div>
                )}

                {t.notes && (
                  <p className="text-xs text-muted-foreground mt-3">{t.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Vision Test Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Record Vision Test
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Test Date</Label>
                <Input type="date" value={form.testDate} onChange={(e) => setForm((p) => ({ ...p, testDate: e.target.value }))} />
              </div>
            </div>

            {/* Visual Acuity */}
            <div>
              <p className="text-sm font-medium mb-2">Visual Acuity</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">OD (Right Eye)</Label>
                  <Input value={form.odAcuity} onChange={(e) => setForm((p) => ({ ...p, odAcuity: e.target.value }))} placeholder="e.g., 20/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">OS (Left Eye)</Label>
                  <Input value={form.osAcuity} onChange={(e) => setForm((p) => ({ ...p, osAcuity: e.target.value }))} placeholder="e.g., 20/25" />
                </div>
              </div>
            </div>

            {/* Refraction */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <Glasses className="h-4 w-4" /> Refraction / Lens Rx
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">OD (Right Eye)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Sphere</Label>
                      <Input type="number" step="0.25" value={form.odSphere} onChange={(e) => setForm((p) => ({ ...p, odSphere: e.target.value }))} placeholder="±0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cylinder</Label>
                      <Input type="number" step="0.25" value={form.odCylinder} onChange={(e) => setForm((p) => ({ ...p, odCylinder: e.target.value }))} placeholder="±0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Axis (°)</Label>
                      <Input type="number" min="0" max="180" value={form.odAxis} onChange={(e) => setForm((p) => ({ ...p, odAxis: e.target.value }))} placeholder="0–180" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">OS (Left Eye)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Sphere</Label>
                      <Input type="number" step="0.25" value={form.osSphere} onChange={(e) => setForm((p) => ({ ...p, osSphere: e.target.value }))} placeholder="±0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cylinder</Label>
                      <Input type="number" step="0.25" value={form.osCylinder} onChange={(e) => setForm((p) => ({ ...p, osCylinder: e.target.value }))} placeholder="±0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Axis (°)</Label>
                      <Input type="number" min="0" max="180" value={form.osAxis} onChange={(e) => setForm((p) => ({ ...p, osAxis: e.target.value }))} placeholder="0–180" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Add & PD */}
            <div>
              <p className="text-sm font-medium mb-2">Near Add & PD</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">OD Add</Label>
                  <Input type="number" step="0.25" value={form.odAdd} onChange={(e) => setForm((p) => ({ ...p, odAdd: e.target.value }))} placeholder="+0.00" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">OS Add</Label>
                  <Input type="number" step="0.25" value={form.osAdd} onChange={(e) => setForm((p) => ({ ...p, osAdd: e.target.value }))} placeholder="+0.00" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">PD (mm)</Label>
                  <Input type="number" step="0.5" value={form.pdMm} onChange={(e) => setForm((p) => ({ ...p, pdMm: e.target.value }))} placeholder="62.0" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Clinical observations..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.patientId}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
