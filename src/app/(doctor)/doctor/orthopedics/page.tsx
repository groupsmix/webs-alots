"use client";

import { useState, useEffect } from "react";
import NextImage from "next/image";
import {
  Bone, Plus, Save, Calendar, Image as ImageIcon,
  Target, CheckCircle, Clock, AlertTriangle,
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
  fetchXRayRecords, createXRayRecord,
  fetchFractureRecords, createFractureRecord, updateFractureRecord,
  fetchRehabPlans, createRehabPlan,
  type XRayRecordView, type FractureRecordView, type RehabPlanView,
} from "@/lib/data/specialists";
import { PageLoader } from "@/components/ui/page-loader";

const FRACTURE_STATUSES: Record<string, { label: string; variant: "default" | "warning" | "success" | "destructive" }> = {
  diagnosed: { label: "Diagnosed", variant: "destructive" },
  treating: { label: "In Treatment", variant: "warning" },
  healing: { label: "Healing", variant: "default" },
  healed: { label: "Healed", variant: "success" },
};

export default function OrthopedicsPage() {
  const [xrays, setXrays] = useState<XRayRecordView[]>([]);
  const [fractures, setFractures] = useState<FractureRecordView[]>([]);
  const [rehabPlans, setRehabPlans] = useState<RehabPlanView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showXrayForm, setShowXrayForm] = useState(false);
  const [showFractureForm, setShowFractureForm] = useState(false);
  const [showRehabForm, setShowRehabForm] = useState(false);

  const [xrayForm, setXrayForm] = useState({ bodyPart: "", findings: "", diagnosis: "" });
  const [fractureForm, setFractureForm] = useState({
    location: "", fractureType: "", severity: "moderate", injuryDate: "", expectedHealingDate: "", notes: "",
  });
  const [rehabForm, setRehabForm] = useState({
    title: "", condition: "", targetEndDate: "", notes: "",
    milestones: [{ title: "", targetDate: "", completed: false }],
  });

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [x, f, r] = await Promise.all([
      fetchXRayRecords(user.clinic_id),
      fetchFractureRecords(user.clinic_id),
      fetchRehabPlans(user.clinic_id),
    ]);
    setXrays(x);
    setFractures(f);
    setRehabPlans(r);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return <PageLoader message="Loading orthopedics records..." />;
  }

  const handleAddXray = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !xrayForm.bodyPart) return;
    const newId = await createXRayRecord({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      body_part: xrayForm.bodyPart, findings: xrayForm.findings, diagnosis: xrayForm.diagnosis,
    });
    if (newId) {
      setXrays((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        recordDate: new Date().toISOString().split("T")[0],
        bodyPart: xrayForm.bodyPart, imageUrl: "", annotations: [],
        findings: xrayForm.findings, diagnosis: xrayForm.diagnosis,
      }, ...prev]);
    }
    setXrayForm({ bodyPart: "", findings: "", diagnosis: "" });
    setShowXrayForm(false);
  };

  const handleAddFracture = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !fractureForm.location) return;
    const newId = await createFractureRecord({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      location: fractureForm.location, fracture_type: fractureForm.fractureType,
      severity: fractureForm.severity, injury_date: fractureForm.injuryDate || new Date().toISOString().split("T")[0],
      expected_healing_date: fractureForm.expectedHealingDate || undefined, notes: fractureForm.notes,
    });
    if (newId) {
      setFractures((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        location: fractureForm.location, fractureType: fractureForm.fractureType,
        severity: fractureForm.severity, status: "diagnosed",
        injuryDate: fractureForm.injuryDate || new Date().toISOString().split("T")[0],
        diagnosisDate: new Date().toISOString().split("T")[0],
        expectedHealingDate: fractureForm.expectedHealingDate,
        notes: fractureForm.notes, xrayRecordId: "",
      }, ...prev]);
    }
    setFractureForm({ location: "", fractureType: "", severity: "moderate", injuryDate: "", expectedHealingDate: "", notes: "" });
    setShowFractureForm(false);
  };

  const handleFractureStatus = async (id: string, status: string) => {
    const ok = await updateFractureRecord(id, { status });
    if (ok) setFractures((prev) => prev.map((f) => f.id === id ? { ...f, status } : f));
  };

  const handleAddRehab = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !rehabForm.title) return;
    const milestones = rehabForm.milestones.filter((m) => m.title);
    const newId = await createRehabPlan({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      title: rehabForm.title, condition: rehabForm.condition,
      target_end_date: rehabForm.targetEndDate || undefined,
      milestones, notes: rehabForm.notes,
    });
    if (newId) {
      setRehabPlans((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        title: rehabForm.title, condition: rehabForm.condition,
        startDate: new Date().toISOString().split("T")[0],
        targetEndDate: rehabForm.targetEndDate, status: "active",
        milestones, notes: rehabForm.notes,
      }, ...prev]);
    }
    setRehabForm({ title: "", condition: "", targetEndDate: "", notes: "", milestones: [{ title: "", targetDate: "", completed: false }] });
    setShowRehabForm(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Orthopedics</h1>

      <Tabs defaultValue="xrays">
        <TabsList className="mb-4">
          <TabsTrigger value="xrays">X-Ray Records</TabsTrigger>
          <TabsTrigger value="fractures">Fracture Tracking</TabsTrigger>
          <TabsTrigger value="rehab">Rehabilitation Plans</TabsTrigger>
        </TabsList>

        {/* X-RAY RECORDS TAB */}
        <TabsContent value="xrays">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowXrayForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add X-Ray
            </Button>
          </div>
          {xrays.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No X-ray records.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {xrays.map((xray) => (
                <Card key={xray.id}>
                  <CardContent className="p-4">
                    <div className="relative aspect-video rounded-lg bg-muted flex items-center justify-center mb-3">
                      {xray.imageUrl ? (
                        <NextImage src={xray.imageUrl} alt={xray.bodyPart} fill className="rounded-lg object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{xray.bodyPart}</span>
                      <span className="text-xs text-muted-foreground">{xray.recordDate}</span>
                    </div>
                    {xray.findings && <p className="text-sm text-muted-foreground mb-1">
                      <span className="font-medium">Findings:</span> {xray.findings}
                    </p>}
                    {xray.diagnosis && <p className="text-sm">
                      <span className="font-medium">Diagnosis:</span> {xray.diagnosis}
                    </p>}
                    {xray.annotations.length > 0 && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {xray.annotations.length} annotation(s)
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* FRACTURE TRACKING TAB */}
        <TabsContent value="fractures">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowFractureForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Fracture
            </Button>
          </div>
          {fractures.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Bone className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No fracture records.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {fractures.map((f) => (
                <Card key={f.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bone className="h-4 w-4" />
                        <span className="font-medium text-sm">{f.location}</span>
                        {f.fractureType && <Badge variant="outline" className="text-xs">{f.fractureType}</Badge>}
                      </div>
                      <Badge variant={FRACTURE_STATUSES[f.status]?.variant ?? "default"}>
                        {FRACTURE_STATUSES[f.status]?.label ?? f.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                        <span>Severity: {f.severity}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>Injury: {f.injuryDate}</span>
                      </div>
                      {f.expectedHealingDate && (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span>Expected: {f.expectedHealingDate}</span>
                        </div>
                      )}
                    </div>
                    {f.notes && <p className="text-sm text-muted-foreground mb-3">{f.notes}</p>}
                    <div className="flex gap-2">
                      {f.status === "diagnosed" && (
                        <Button variant="outline" size="sm" onClick={() => handleFractureStatus(f.id, "treating")}>
                          Start Treatment
                        </Button>
                      )}
                      {f.status === "treating" && (
                        <Button variant="outline" size="sm" onClick={() => handleFractureStatus(f.id, "healing")}>
                          Mark Healing
                        </Button>
                      )}
                      {f.status === "healing" && (
                        <Button variant="outline" size="sm" className="text-green-600" onClick={() => handleFractureStatus(f.id, "healed")}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Healed
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* REHAB PLANS TAB */}
        <TabsContent value="rehab">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowRehabForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Rehab Plan
            </Button>
          </div>
          {rehabPlans.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No rehabilitation plans.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {rehabPlans.map((plan) => {
                const completed = plan.milestones.filter((m) => m.completed).length;
                const total = plan.milestones.length;
                return (
                  <Card key={plan.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{plan.title}</CardTitle>
                        <Badge variant={plan.status === "active" ? "default" : plan.status === "completed" ? "success" : "warning"}>
                          {plan.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                        <div><span className="text-muted-foreground">Condition:</span> {plan.condition}</div>
                        <div><span className="text-muted-foreground">Start:</span> {plan.startDate}</div>
                        {plan.targetEndDate && <div><span className="text-muted-foreground">Target:</span> {plan.targetEndDate}</div>}
                      </div>
                      {total > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>Progress</span>
                            <span>{completed}/{total} milestones</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completed / total) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      {plan.milestones.length > 0 && (
                        <div className="space-y-1">
                          {plan.milestones.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              {m.completed ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className={m.completed ? "line-through text-muted-foreground" : ""}>{m.title}</span>
                              {m.targetDate && <span className="text-xs text-muted-foreground ml-auto">{m.targetDate}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* X-Ray Form Dialog */}
      <Dialog open={showXrayForm} onOpenChange={setShowXrayForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add X-Ray Record</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Body Part</Label>
              <Input placeholder="e.g., Left Wrist, Lumbar Spine" value={xrayForm.bodyPart}
                onChange={(e) => setXrayForm((p) => ({ ...p, bodyPart: e.target.value }))} />
            </div>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Attach X-Ray Image</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs">Browse</Button>
            </div>
            <div className="space-y-2">
              <Label>Findings</Label>
              <Textarea placeholder="Radiological findings..." value={xrayForm.findings}
                onChange={(e) => setXrayForm((p) => ({ ...p, findings: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea placeholder="Diagnosis..." value={xrayForm.diagnosis}
                onChange={(e) => setXrayForm((p) => ({ ...p, diagnosis: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowXrayForm(false)}>Cancel</Button>
              <Button onClick={handleAddXray}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fracture Form Dialog */}
      <Dialog open={showFractureForm} onOpenChange={setShowFractureForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Fracture Record</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input placeholder="e.g., Right Femur" value={fractureForm.location}
                  onChange={(e) => setFractureForm((p) => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={fractureForm.fractureType} onValueChange={(v) => setFractureForm((p) => ({ ...p, fractureType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="compound">Compound</SelectItem>
                    <SelectItem value="comminuted">Comminuted</SelectItem>
                    <SelectItem value="stress">Stress</SelectItem>
                    <SelectItem value="greenstick">Greenstick</SelectItem>
                    <SelectItem value="spiral">Spiral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={fractureForm.severity} onValueChange={(v) => setFractureForm((p) => ({ ...p, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Injury Date</Label>
                <Input type="date" value={fractureForm.injuryDate}
                  onChange={(e) => setFractureForm((p) => ({ ...p, injuryDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Expected Healing</Label>
                <Input type="date" value={fractureForm.expectedHealingDate}
                  onChange={(e) => setFractureForm((p) => ({ ...p, expectedHealingDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Clinical notes..." value={fractureForm.notes}
                onChange={(e) => setFractureForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowFractureForm(false)}>Cancel</Button>
              <Button onClick={handleAddFracture}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rehab Plan Form Dialog */}
      <Dialog open={showRehabForm} onOpenChange={setShowRehabForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Rehabilitation Plan</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="Plan title" value={rehabForm.title}
                  onChange={(e) => setRehabForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Input placeholder="Related condition" value={rehabForm.condition}
                  onChange={(e) => setRehabForm((p) => ({ ...p, condition: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target End Date</Label>
              <Input type="date" value={rehabForm.targetEndDate}
                onChange={(e) => setRehabForm((p) => ({ ...p, targetEndDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Milestones</Label>
              {rehabForm.milestones.map((m, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Input placeholder="Milestone title" value={m.title}
                    onChange={(e) => {
                      const ms = [...rehabForm.milestones];
                      ms[i] = { ...ms[i], title: e.target.value };
                      setRehabForm((p) => ({ ...p, milestones: ms }));
                    }} />
                  <Input type="date" value={m.targetDate}
                    onChange={(e) => {
                      const ms = [...rehabForm.milestones];
                      ms[i] = { ...ms[i], targetDate: e.target.value };
                      setRehabForm((p) => ({ ...p, milestones: ms }));
                    }} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() =>
                setRehabForm((p) => ({ ...p, milestones: [...p.milestones, { title: "", targetDate: "", completed: false }] }))
              }>
                <Plus className="h-3 w-3 mr-1" /> Add Milestone
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={rehabForm.notes}
                onChange={(e) => setRehabForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRehabForm(false)}>Cancel</Button>
              <Button onClick={handleAddRehab}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
