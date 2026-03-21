"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Droplets, Plus, Save, TrendingUp,
  AlertTriangle, Pill, ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  fetchBloodSugarReadings, createBloodSugarReading,
  fetchHormoneLevels, createHormoneLevel,
  fetchDiabetesManagement, createDiabetesManagement, updateDiabetesManagement,
  type BloodSugarReadingView, type HormoneLevelView, type DiabetesManagementView,
} from "@/lib/data/specialists";

function glucoseCategory(level: number, type: string): { label: string; color: string } {
  if (type === "fasting") {
    if (level < 70) return { label: "Low", color: "text-blue-600" };
    if (level <= 100) return { label: "Normal", color: "text-green-600" };
    if (level <= 125) return { label: "Pre-diabetic", color: "text-yellow-600" };
    return { label: "Diabetic", color: "text-red-600" };
  }
  if (level < 70) return { label: "Low", color: "text-blue-600" };
  if (level <= 140) return { label: "Normal", color: "text-green-600" };
  if (level <= 199) return { label: "Pre-diabetic", color: "text-yellow-600" };
  return { label: "Diabetic", color: "text-red-600" };
}

export default function EndocrinologyPage() {
  const [sugars, setSugars] = useState<BloodSugarReadingView[]>([]);
  const [hormones, setHormones] = useState<HormoneLevelView[]>([]);
  const [diabetes, setDiabetes] = useState<DiabetesManagementView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSugarForm, setShowSugarForm] = useState(false);
  const [showHormoneForm, setShowHormoneForm] = useState(false);
  const [showDiabetesForm, setShowDiabetesForm] = useState(false);

  const [sugarForm, setSugarForm] = useState({
    glucoseLevel: "", readingType: "fasting", unit: "mg/dL", notes: "",
  });
  const [hormoneForm, setHormoneForm] = useState({
    hormoneName: "", value: "", unit: "", referenceRange: "", isAbnormal: false, notes: "",
  });
  const [diabetesForm, setDiabetesForm] = useState({
    diabetesType: "type_2", diagnosisDate: "", currentHba1c: "", targetHba1c: "7.0",
    dietPlan: "", exercisePlan: "", monitoringFrequency: "daily", notes: "",
  });

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [s, h, d] = await Promise.all([
      fetchBloodSugarReadings(user.clinic_id),
      fetchHormoneLevels(user.clinic_id),
      fetchDiabetesManagement(user.clinic_id),
    ]);
    setSugars(s);
    setHormones(h);
    setDiabetes(d);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading endocrinology records...</p>
      </div>
    );
  }

  const handleAddSugar = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !sugarForm.glucoseLevel) return;
    const newId = await createBloodSugarReading({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      glucose_level: parseFloat(sugarForm.glucoseLevel),
      reading_type: sugarForm.readingType, unit: sugarForm.unit, notes: sugarForm.notes,
    });
    if (newId) {
      setSugars((prev) => [{
        id: newId, patientId: user.id,
        readingDate: new Date().toISOString().split("T")[0],
        glucoseLevel: parseFloat(sugarForm.glucoseLevel),
        readingType: sugarForm.readingType, unit: sugarForm.unit, notes: sugarForm.notes,
      }, ...prev]);
    }
    setSugarForm({ glucoseLevel: "", readingType: "fasting", unit: "mg/dL", notes: "" });
    setShowSugarForm(false);
  };

  const handleAddHormone = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !hormoneForm.hormoneName || !hormoneForm.value) return;
    const newId = await createHormoneLevel({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      hormone_name: hormoneForm.hormoneName, value: parseFloat(hormoneForm.value),
      unit: hormoneForm.unit, reference_range: hormoneForm.referenceRange,
      is_abnormal: hormoneForm.isAbnormal, notes: hormoneForm.notes,
    });
    if (newId) {
      setHormones((prev) => [{
        id: newId, patientId: user.id,
        testDate: new Date().toISOString().split("T")[0],
        hormoneName: hormoneForm.hormoneName, value: parseFloat(hormoneForm.value),
        unit: hormoneForm.unit, referenceRange: hormoneForm.referenceRange,
        isAbnormal: hormoneForm.isAbnormal, notes: hormoneForm.notes,
      }, ...prev]);
    }
    setHormoneForm({ hormoneName: "", value: "", unit: "", referenceRange: "", isAbnormal: false, notes: "" });
    setShowHormoneForm(false);
  };

  const handleAddDiabetes = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const newId = await createDiabetesManagement({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      diabetes_type: diabetesForm.diabetesType,
      diagnosis_date: diabetesForm.diagnosisDate || undefined,
      current_hba1c: diabetesForm.currentHba1c ? parseFloat(diabetesForm.currentHba1c) : undefined,
      target_hba1c: parseFloat(diabetesForm.targetHba1c),
      diet_plan: diabetesForm.dietPlan, exercise_plan: diabetesForm.exercisePlan,
      monitoring_frequency: diabetesForm.monitoringFrequency, notes: diabetesForm.notes,
    });
    if (newId) {
      setDiabetes((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        diabetesType: diabetesForm.diabetesType,
        diagnosisDate: diabetesForm.diagnosisDate,
        currentHba1c: diabetesForm.currentHba1c ? parseFloat(diabetesForm.currentHba1c) : null,
        targetHba1c: parseFloat(diabetesForm.targetHba1c),
        medications: [], dietPlan: diabetesForm.dietPlan,
        exercisePlan: diabetesForm.exercisePlan,
        monitoringFrequency: diabetesForm.monitoringFrequency,
        notes: diabetesForm.notes, lastReviewDate: "",
      }, ...prev]);
    }
    setDiabetesForm({ diabetesType: "type_2", diagnosisDate: "", currentHba1c: "", targetHba1c: "7.0", dietPlan: "", exercisePlan: "", monitoringFrequency: "daily", notes: "" });
    setShowDiabetesForm(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Endocrinology</h1>

      <Tabs defaultValue="sugar">
        <TabsList className="mb-4">
          <TabsTrigger value="sugar">Blood Sugar</TabsTrigger>
          <TabsTrigger value="hormones">Hormone Levels</TabsTrigger>
          <TabsTrigger value="diabetes">Diabetes Management</TabsTrigger>
        </TabsList>

        {/* BLOOD SUGAR TAB */}
        <TabsContent value="sugar">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowSugarForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Reading
            </Button>
          </div>

          {/* Sugar Summary */}
          {sugars.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Latest</p>
                  <p className="text-2xl font-bold">{sugars[0].glucoseLevel}</p>
                  <p className={`text-xs font-medium ${glucoseCategory(sugars[0].glucoseLevel, sugars[0].readingType).color}`}>
                    {glucoseCategory(sugars[0].glucoseLevel, sugars[0].readingType).label}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="text-2xl font-bold">
                    {Math.round(sugars.reduce((sum, r) => sum + r.glucoseLevel, 0) / sugars.length)}
                  </p>
                  <p className="text-xs text-muted-foreground">{sugars[0].unit}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Readings</p>
                  <p className="text-2xl font-bold">{sugars.length}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Sugar History */}
          {sugars.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Droplets className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No blood sugar readings.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-sm">Blood Sugar History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sugars.slice(0, 20).map((s) => {
                    const cat = glucoseCategory(s.glucoseLevel, s.readingType);
                    return (
                      <div key={s.id} className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground w-24">{s.readingDate}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="h-2 rounded-full bg-blue-200" style={{ width: `${Math.min((s.glucoseLevel / 300) * 100, 100)}%` }} />
                          <span className="font-medium">{s.glucoseLevel} {s.unit}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{s.readingType}</Badge>
                        <span className={`text-xs ${cat.color}`}>{cat.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HORMONES TAB */}
        <TabsContent value="hormones">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowHormoneForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Hormone Level
            </Button>
          </div>

          {hormones.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hormone levels tracked.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {hormones.map((h) => (
                <Card key={h.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{h.hormoneName}</span>
                      <div className="flex items-center gap-2">
                        {h.isAbnormal && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Abnormal
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{h.testDate}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Value:</span> {h.value} {h.unit}</div>
                      {h.referenceRange && <div><span className="text-muted-foreground">Reference:</span> {h.referenceRange}</div>}
                    </div>
                    {h.notes && <p className="text-sm text-muted-foreground mt-2">{h.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* DIABETES MANAGEMENT TAB */}
        <TabsContent value="diabetes">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowDiabetesForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Plan
            </Button>
          </div>

          {diabetes.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No diabetes management plans.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {diabetes.map((d) => (
                <Card key={d.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {d.diabetesType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </CardTitle>
                      {d.currentHba1c !== null && (
                        <Badge variant={d.currentHba1c <= d.targetHba1c ? "default" : "destructive"}>
                          HbA1c: {d.currentHba1c}% (target: {d.targetHba1c}%)
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      {d.diagnosisDate && <div><span className="text-muted-foreground">Diagnosed:</span> {d.diagnosisDate}</div>}
                      <div><span className="text-muted-foreground">Monitoring:</span> {d.monitoringFrequency}</div>
                    </div>
                    {d.medications.length > 0 && (
                      <div className="rounded-lg bg-muted/50 p-3 mb-3">
                        <p className="text-xs font-medium mb-1 flex items-center gap-1"><Pill className="h-3 w-3" /> Medications</p>
                        {d.medications.map((m, i) => (
                          <div key={i} className="text-sm flex gap-2">
                            <span className="font-medium">{m.name}</span>
                            <span className="text-muted-foreground">{m.dosage} - {m.frequency}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {d.dietPlan && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground">Diet Plan</p>
                        <p className="text-sm">{d.dietPlan}</p>
                      </div>
                    )}
                    {d.exercisePlan && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground">Exercise Plan</p>
                        <p className="text-sm">{d.exercisePlan}</p>
                      </div>
                    )}
                    {d.notes && <p className="text-sm text-muted-foreground">{d.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Blood Sugar Form */}
      <Dialog open={showSugarForm} onOpenChange={setShowSugarForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Blood Sugar Reading</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Glucose Level</Label>
                <Input type="number" placeholder="100" value={sugarForm.glucoseLevel}
                  onChange={(e) => setSugarForm((p) => ({ ...p, glucoseLevel: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={sugarForm.readingType} onValueChange={(v) => setSugarForm((p) => ({ ...p, readingType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fasting">Fasting</SelectItem>
                    <SelectItem value="post_meal">Post Meal</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                    <SelectItem value="bedtime">Bedtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={sugarForm.unit} onValueChange={(v) => setSugarForm((p) => ({ ...p, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mg/dL">mg/dL</SelectItem>
                    <SelectItem value="mmol/L">mmol/L</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Notes..." value={sugarForm.notes}
                onChange={(e) => setSugarForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSugarForm(false)}>Cancel</Button>
              <Button onClick={handleAddSugar}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hormone Form */}
      <Dialog open={showHormoneForm} onOpenChange={setShowHormoneForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Hormone Level</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Hormone Name</Label>
              <Select value={hormoneForm.hormoneName} onValueChange={(v) => setHormoneForm((p) => ({ ...p, hormoneName: v }))}>
                <SelectTrigger><SelectValue placeholder="Select hormone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TSH">TSH</SelectItem>
                  <SelectItem value="T3">T3</SelectItem>
                  <SelectItem value="T4">T4</SelectItem>
                  <SelectItem value="Free T4">Free T4</SelectItem>
                  <SelectItem value="Cortisol">Cortisol</SelectItem>
                  <SelectItem value="Insulin">Insulin</SelectItem>
                  <SelectItem value="Testosterone">Testosterone</SelectItem>
                  <SelectItem value="Estrogen">Estrogen</SelectItem>
                  <SelectItem value="Progesterone">Progesterone</SelectItem>
                  <SelectItem value="Growth Hormone">Growth Hormone</SelectItem>
                  <SelectItem value="PTH">PTH</SelectItem>
                  <SelectItem value="Prolactin">Prolactin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={hormoneForm.value}
                  onChange={(e) => setHormoneForm((p) => ({ ...p, value: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input placeholder="mIU/L" value={hormoneForm.unit}
                  onChange={(e) => setHormoneForm((p) => ({ ...p, unit: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Reference Range</Label>
                <Input placeholder="0.5-4.5" value={hormoneForm.referenceRange}
                  onChange={(e) => setHormoneForm((p) => ({ ...p, referenceRange: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="abnormal" checked={hormoneForm.isAbnormal}
                onChange={(e) => setHormoneForm((p) => ({ ...p, isAbnormal: e.target.checked }))} />
              <Label htmlFor="abnormal" className="text-sm">Mark as abnormal</Label>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Notes..." value={hormoneForm.notes}
                onChange={(e) => setHormoneForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowHormoneForm(false)}>Cancel</Button>
              <Button onClick={handleAddHormone}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diabetes Management Form */}
      <Dialog open={showDiabetesForm} onOpenChange={setShowDiabetesForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Diabetes Management Plan</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Diabetes Type</Label>
                <Select value={diabetesForm.diabetesType} onValueChange={(v) => setDiabetesForm((p) => ({ ...p, diabetesType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="type_1">Type 1</SelectItem>
                    <SelectItem value="type_2">Type 2</SelectItem>
                    <SelectItem value="gestational">Gestational</SelectItem>
                    <SelectItem value="prediabetes">Prediabetes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Diagnosis Date</Label>
                <Input type="date" value={diabetesForm.diagnosisDate}
                  onChange={(e) => setDiabetesForm((p) => ({ ...p, diagnosisDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Current HbA1c (%)</Label>
                <Input type="number" step="0.1" placeholder="7.0" value={diabetesForm.currentHba1c}
                  onChange={(e) => setDiabetesForm((p) => ({ ...p, currentHba1c: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Target HbA1c (%)</Label>
                <Input type="number" step="0.1" value={diabetesForm.targetHba1c}
                  onChange={(e) => setDiabetesForm((p) => ({ ...p, targetHba1c: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Monitoring</Label>
                <Select value={diabetesForm.monitoringFrequency} onValueChange={(v) => setDiabetesForm((p) => ({ ...p, monitoringFrequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="twice_daily">Twice Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Diet Plan</Label>
              <Textarea placeholder="Dietary recommendations..." value={diabetesForm.dietPlan}
                onChange={(e) => setDiabetesForm((p) => ({ ...p, dietPlan: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Exercise Plan</Label>
              <Textarea placeholder="Exercise recommendations..." value={diabetesForm.exercisePlan}
                onChange={(e) => setDiabetesForm((p) => ({ ...p, exercisePlan: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={diabetesForm.notes}
                onChange={(e) => setDiabetesForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDiabetesForm(false)}>Cancel</Button>
              <Button onClick={handleAddDiabetes}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
