"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Image, FileText } from "lucide-react";
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
  fetchUltrasounds,
  createUltrasound,
  fetchPregnancies,
  type UltrasoundView,
  type PregnancyView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function UltrasoundsPage() {
  const [ultrasounds, setUltrasounds] = useState<UltrasoundView[]>([]);
  const [pregnancies, setPregnancies] = useState<PregnancyView[]>([]);
  const [selectedPregnancy, setSelectedPregnancy] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    pregnancyId: "",
    scanDate: new Date().toISOString().split("T")[0],
    trimester: "1",
    gestationalWeeks: "",
    gestationalDays: "",
    findings: "",
    notes: "",
    // Common measurements
    crl: "", // Crown-rump length
    bpd: "", // Biparietal diameter
    hc: "",  // Head circumference
    ac: "",  // Abdominal circumference
    fl: "",  // Femur length
    efw: "", // Estimated fetal weight
  });

  const load = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [u, p] = await Promise.all([
      fetchUltrasounds(user.clinic_id, selectedPregnancy || undefined),
      fetchPregnancies(user.clinic_id),
    ]);
    setUltrasounds(u);
    setPregnancies(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedPregnancy]);

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const preg = pregnancies.find((p) => p.id === form.pregnancyId);
    if (!preg) return;

    const measurements: Record<string, unknown> = {};
    if (form.crl) measurements.crl_mm = parseFloat(form.crl);
    if (form.bpd) measurements.bpd_mm = parseFloat(form.bpd);
    if (form.hc) measurements.hc_mm = parseFloat(form.hc);
    if (form.ac) measurements.ac_mm = parseFloat(form.ac);
    if (form.fl) measurements.fl_mm = parseFloat(form.fl);
    if (form.efw) measurements.efw_g = parseFloat(form.efw);

    await createUltrasound({
      clinic_id: user.clinic_id,
      pregnancy_id: form.pregnancyId,
      patient_id: preg.patientId,
      doctor_id: user.id,
      scan_date: form.scanDate,
      trimester: parseInt(form.trimester),
      gestational_weeks: parseInt(form.gestationalWeeks) || undefined,
      gestational_days: parseInt(form.gestationalDays) || undefined,
      measurements: Object.keys(measurements).length > 0 ? measurements : undefined,
      findings: form.findings || undefined,
      notes: form.notes || undefined,
    });
    setShowAdd(false);
    setForm({ pregnancyId: "", scanDate: new Date().toISOString().split("T")[0], trimester: "1", gestationalWeeks: "", gestationalDays: "", findings: "", notes: "", crl: "", bpd: "", hc: "", ac: "", fl: "", efw: "" });
    load();
  };

  if (loading) {
    return <PageLoader message="Loading ultrasound records..." />;
  }

  const activePregnancies = pregnancies.filter((p) => p.status === "active");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ultrasound Records</h1>
        <Button onClick={() => setShowAdd(true)} disabled={activePregnancies.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> New Ultrasound
        </Button>
      </div>

      {/* Pregnancy filter */}
      <div className="mb-6 max-w-md">
        <Select value={selectedPregnancy} onValueChange={(v) => setSelectedPregnancy(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="All pregnancies" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pregnancies</SelectItem>
            {pregnancies.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.patientName} — EDD: {p.eddDate} ({p.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ultrasounds.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Image className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No ultrasound records yet.</p>
            {activePregnancies.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">Create an active pregnancy first to add ultrasound records.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ultrasounds.map((u) => (
            <Card key={u.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{u.patientName}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">T{u.trimester}</Badge>
                    {u.gestationalWeeks !== null && (
                      <Badge variant="default">
                        {u.gestationalWeeks}w {u.gestationalDays ?? 0}d
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{u.scanDate}</p>
              </CardHeader>
              <CardContent>
                {/* Measurements */}
                {Object.keys(u.measurements).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-2">Measurements</p>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {Object.entries(u.measurements).map(([key, val]) => (
                        <div key={key} className="text-center p-2 rounded bg-gray-50 dark:bg-gray-800">
                          <p className="text-xs text-muted-foreground uppercase">{key.replace(/_/g, " ")}</p>
                          <p className="text-sm font-medium">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {u.findings && (
                  <div className="mb-3">
                    <p className="text-xs font-medium mb-1">Findings</p>
                    <p className="text-sm text-muted-foreground">{u.findings}</p>
                  </div>
                )}

                {u.imageUrls.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium mb-1">Images</p>
                    <div className="flex gap-2 flex-wrap">
                      {u.imageUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs flex items-center gap-1">
                          <Image className="h-3 w-3" /> Image {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {u.notes && <p className="text-xs text-muted-foreground">{u.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Ultrasound Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Record Ultrasound
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Pregnancy</Label>
              <Select value={form.pregnancyId} onValueChange={(v) => setForm((p) => ({ ...p, pregnancyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select active pregnancy" /></SelectTrigger>
                <SelectContent>
                  {activePregnancies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.patientName} — {p.gestationalWeeks}w {p.gestationalDays}d
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Scan Date</Label>
                <Input type="date" value={form.scanDate} onChange={(e) => setForm((p) => ({ ...p, scanDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Trimester</Label>
                <Select value={form.trimester} onValueChange={(v) => setForm((p) => ({ ...p, trimester: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1st</SelectItem>
                    <SelectItem value="2">2nd</SelectItem>
                    <SelectItem value="3">3rd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>GA (weeks+days)</Label>
                <div className="flex gap-1">
                  <Input type="number" min="0" max="42" placeholder="w" value={form.gestationalWeeks} onChange={(e) => setForm((p) => ({ ...p, gestationalWeeks: e.target.value }))} />
                  <Input type="number" min="0" max="6" placeholder="d" value={form.gestationalDays} onChange={(e) => setForm((p) => ({ ...p, gestationalDays: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Measurements</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CRL (mm)</Label>
                  <Input type="number" step="0.1" value={form.crl} onChange={(e) => setForm((p) => ({ ...p, crl: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">BPD (mm)</Label>
                  <Input type="number" step="0.1" value={form.bpd} onChange={(e) => setForm((p) => ({ ...p, bpd: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">HC (mm)</Label>
                  <Input type="number" step="0.1" value={form.hc} onChange={(e) => setForm((p) => ({ ...p, hc: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">AC (mm)</Label>
                  <Input type="number" step="0.1" value={form.ac} onChange={(e) => setForm((p) => ({ ...p, ac: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">FL (mm)</Label>
                  <Input type="number" step="0.1" value={form.fl} onChange={(e) => setForm((p) => ({ ...p, fl: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">EFW (g)</Label>
                  <Input type="number" value={form.efw} onChange={(e) => setForm((p) => ({ ...p, efw: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Findings</Label>
              <Textarea value={form.findings} onChange={(e) => setForm((p) => ({ ...p, findings: e.target.value }))} placeholder="Ultrasound findings..." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.pregnancyId}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
