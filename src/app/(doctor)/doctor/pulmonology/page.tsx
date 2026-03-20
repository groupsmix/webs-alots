"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wind, Plus, Save, Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/data/client";
import {
  fetchSpirometryRecords, createSpirometryRecord,
  fetchRespiratoryTests, createRespiratoryTest,
  type SpirometryRecordView, type RespiratoryTestView,
} from "@/lib/data/specialists";

function spirometryInterpretation(fev1FvcRatio: number | null): string {
  if (fev1FvcRatio === null) return "Insufficient data";
  if (fev1FvcRatio >= 0.7) return "Normal ratio";
  if (fev1FvcRatio >= 0.6) return "Mild obstruction";
  if (fev1FvcRatio >= 0.5) return "Moderate obstruction";
  return "Severe obstruction";
}

export default function PulmonologyPage() {
  const [spirometry, setSpirometry] = useState<SpirometryRecordView[]>([]);
  const [respTests, setRespTests] = useState<RespiratoryTestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSpiroForm, setShowSpiroForm] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);

  const [spiroForm, setSpiroForm] = useState({
    fvc: "", fev1: "", pef: "", interpretation: "", testQuality: "good", notes: "",
  });
  const [testForm, setTestForm] = useState({
    testType: "chest_xray", results: {} as Record<string, string>,
    interpretation: "", notes: "",
  });

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [s, r] = await Promise.all([
      fetchSpirometryRecords(user.clinic_id),
      fetchRespiratoryTests(user.clinic_id),
    ]);
    setSpirometry(s);
    setRespTests(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading pulmonology records...</p>
      </div>
    );
  }

  const handleAddSpiro = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const fvc = spiroForm.fvc ? parseFloat(spiroForm.fvc) : undefined;
    const fev1 = spiroForm.fev1 ? parseFloat(spiroForm.fev1) : undefined;
    const ratio = fvc && fev1 ? parseFloat((fev1 / fvc).toFixed(2)) : undefined;
    const newId = await createSpirometryRecord({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      fvc, fev1, fev1_fvc_ratio: ratio,
      pef: spiroForm.pef ? parseFloat(spiroForm.pef) : undefined,
      interpretation: spiroForm.interpretation, test_quality: spiroForm.testQuality,
      notes: spiroForm.notes,
    });
    if (newId) {
      setSpirometry((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        testDate: new Date().toISOString().split("T")[0],
        fvc: fvc ?? null, fev1: fev1 ?? null, fev1FvcRatio: ratio ?? null,
        pef: spiroForm.pef ? parseFloat(spiroForm.pef) : null,
        interpretation: spiroForm.interpretation, testQuality: spiroForm.testQuality,
        notes: spiroForm.notes,
      }, ...prev]);
    }
    setSpiroForm({ fvc: "", fev1: "", pef: "", interpretation: "", testQuality: "good", notes: "" });
    setShowSpiroForm(false);
  };

  const handleAddTest = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const newId = await createRespiratoryTest({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      test_type: testForm.testType, results: testForm.results,
      interpretation: testForm.interpretation, notes: testForm.notes,
    });
    if (newId) {
      setRespTests((prev) => [{
        id: newId, patientId: user.id,
        testDate: new Date().toISOString().split("T")[0],
        testType: testForm.testType, results: testForm.results,
        interpretation: testForm.interpretation, notes: testForm.notes,
      }, ...prev]);
    }
    setTestForm({ testType: "chest_xray", results: {}, interpretation: "", notes: "" });
    setShowTestForm(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pulmonology</h1>

      <Tabs defaultValue="spirometry">
        <TabsList className="mb-4">
          <TabsTrigger value="spirometry">Spirometry</TabsTrigger>
          <TabsTrigger value="tests">Respiratory Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="spirometry">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowSpiroForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Spirometry
            </Button>
          </div>

          {spirometry.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Wind className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No spirometry records.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {spirometry.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Wind className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-sm">{s.testDate}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{s.testQuality}</Badge>
                        {s.fev1FvcRatio !== null && (
                          <Badge variant={s.fev1FvcRatio >= 0.7 ? "default" : "destructive"}>
                            {spirometryInterpretation(s.fev1FvcRatio)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">FVC (L)</p>
                        <p className="text-lg font-bold">{s.fvc?.toFixed(2) ?? "—"}</p>
                      </div>
                      <div className="text-center rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">FEV1 (L)</p>
                        <p className="text-lg font-bold">{s.fev1?.toFixed(2) ?? "—"}</p>
                      </div>
                      <div className="text-center rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">FEV1/FVC</p>
                        <p className="text-lg font-bold">{s.fev1FvcRatio?.toFixed(2) ?? "—"}</p>
                      </div>
                      <div className="text-center rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">PEF (L/s)</p>
                        <p className="text-lg font-bold">{s.pef?.toFixed(1) ?? "—"}</p>
                      </div>
                    </div>
                    {s.interpretation && <p className="text-sm"><span className="font-medium">Interpretation:</span> {s.interpretation}</p>}
                    {s.notes && <p className="text-sm text-muted-foreground mt-1">{s.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tests">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowTestForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Test
            </Button>
          </div>

          {respTests.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No respiratory tests recorded.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {respTests.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{t.testType.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{t.testDate}</span>
                    </div>
                    {Object.entries(t.results).length > 0 && (
                      <div className="rounded-lg bg-muted/50 p-3 mb-2">
                        {Object.entries(t.results).map(([key, value]) => (
                          <div key={key} className="text-sm flex gap-2">
                            <span className="font-medium">{key}:</span>
                            <span className="text-muted-foreground">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.interpretation && <p className="text-sm">{t.interpretation}</p>}
                    {t.notes && <p className="text-sm text-muted-foreground mt-1">{t.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Spirometry Form */}
      <Dialog open={showSpiroForm} onOpenChange={setShowSpiroForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Spirometry Record</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>FVC (L)</Label>
                <Input type="number" step="0.01" placeholder="4.50" value={spiroForm.fvc}
                  onChange={(e) => setSpiroForm((p) => ({ ...p, fvc: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>FEV1 (L)</Label>
                <Input type="number" step="0.01" placeholder="3.60" value={spiroForm.fev1}
                  onChange={(e) => setSpiroForm((p) => ({ ...p, fev1: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>PEF (L/s)</Label>
                <Input type="number" step="0.1" placeholder="9.0" value={spiroForm.pef}
                  onChange={(e) => setSpiroForm((p) => ({ ...p, pef: e.target.value }))} />
              </div>
            </div>
            {spiroForm.fvc && spiroForm.fev1 && (
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <p className="text-xs text-muted-foreground">Calculated FEV1/FVC Ratio</p>
                <p className="text-lg font-bold">{(parseFloat(spiroForm.fev1) / parseFloat(spiroForm.fvc)).toFixed(2)}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Test Quality</Label>
              <Select value={spiroForm.testQuality} onValueChange={(v) => setSpiroForm((p) => ({ ...p, testQuality: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="acceptable">Acceptable</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Interpretation</Label>
              <Textarea placeholder="Clinical interpretation..." value={spiroForm.interpretation}
                onChange={(e) => setSpiroForm((p) => ({ ...p, interpretation: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={spiroForm.notes}
                onChange={(e) => setSpiroForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSpiroForm(false)}>Cancel</Button>
              <Button onClick={handleAddSpiro}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Respiratory Test Form */}
      <Dialog open={showTestForm} onOpenChange={setShowTestForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Respiratory Test</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Test Type</Label>
              <Select value={testForm.testType} onValueChange={(v) => setTestForm((p) => ({ ...p, testType: v, results: {} }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chest_xray">Chest X-Ray</SelectItem>
                  <SelectItem value="ct_scan">CT Scan</SelectItem>
                  <SelectItem value="bronchoscopy">Bronchoscopy</SelectItem>
                  <SelectItem value="arterial_blood_gas">Arterial Blood Gas</SelectItem>
                  <SelectItem value="peak_flow">Peak Flow</SelectItem>
                  <SelectItem value="sleep_study">Sleep Study</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Results</Label>
              {["Finding 1", "Finding 2", "Finding 3"].map((f) => (
                <Input key={f} placeholder={f} value={testForm.results[f] ?? ""}
                  onChange={(e) => setTestForm((p) => ({
                    ...p, results: { ...p.results, [f]: e.target.value },
                  }))} />
              ))}
            </div>
            <div className="space-y-2">
              <Label>Interpretation</Label>
              <Textarea placeholder="Interpretation..." value={testForm.interpretation}
                onChange={(e) => setTestForm((p) => ({ ...p, interpretation: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Notes..." value={testForm.notes}
                onChange={(e) => setTestForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowTestForm(false)}>Cancel</Button>
              <Button onClick={handleAddTest}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
