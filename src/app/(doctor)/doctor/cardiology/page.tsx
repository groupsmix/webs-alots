"use client";

import { useState, useEffect } from "react";
import {
  Heart, Plus, FileText, Activity, AlertTriangle,
  Save,
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
  fetchECGRecords, createECGRecord,
  fetchBloodPressureReadings, createBloodPressureReading,
  fetchHeartMonitoringNotes, createHeartMonitoringNote,
  type ECGRecordView, type BloodPressureView, type HeartMonitoringNoteView,
} from "@/lib/data/specialists";
import { PageLoader } from "@/components/ui/page-loader";

function bpCategory(systolic: number, diastolic: number): { label: string; color: string } {
  // AHA BP classification (checked top-down; Stage 2 must be tested before Stage 1)
  if (systolic >= 180 || diastolic >= 120) return { label: "Hypertensive Crisis", color: "text-red-800" };
  if (systolic >= 140 || diastolic >= 90) return { label: "High Stage 2", color: "text-red-600" };
  if ((systolic >= 130 && systolic < 140) || (diastolic >= 80 && diastolic < 90)) return { label: "High Stage 1", color: "text-orange-600" };
  if (systolic >= 120 && systolic < 130 && diastolic < 80) return { label: "Elevated", color: "text-yellow-600" };
  if (systolic < 120 && diastolic < 80) return { label: "Normal", color: "text-green-600" };
  return { label: "Unknown", color: "text-muted-foreground" };
}

export default function CardiologyPage() {
  const [ecgs, setEcgs] = useState<ECGRecordView[]>([]);
  const [bpReadings, setBpReadings] = useState<BloodPressureView[]>([]);
  const [heartNotes, setHeartNotes] = useState<HeartMonitoringNoteView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showEcgForm, setShowEcgForm] = useState(false);
  const [showBpForm, setShowBpForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);

  const [ecgForm, setEcgForm] = useState({
    heartRate: "", rhythm: "normal_sinus", interpretation: "", notes: "", isAbnormal: false,
  });
  const [bpForm, setBpForm] = useState({
    systolic: "", diastolic: "", heartRate: "", position: "sitting", arm: "left", notes: "",
  });
  const [noteForm, setNoteForm] = useState({
    title: "", content: "", category: "general", severity: "normal", isAlert: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const [e, b, n] = await Promise.all([
      fetchECGRecords(user.clinic_id),
      fetchBloodPressureReadings(user.clinic_id),
      fetchHeartMonitoringNotes(user.clinic_id),
    ]);
      if (controller.signal.aborted) return;
    setEcgs(e);
    setBpReadings(b);
    setHeartNotes(n);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading cardiology records..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const handleAddEcg = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const newId = await createECGRecord({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      heart_rate: ecgForm.heartRate ? parseInt(ecgForm.heartRate) : undefined,
      rhythm: ecgForm.rhythm, interpretation: ecgForm.interpretation,
      notes: ecgForm.notes, is_abnormal: ecgForm.isAbnormal,
    });
    if (newId) {
      setEcgs((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        recordDate: new Date().toISOString().split("T")[0],
        fileUrl: "", heartRate: ecgForm.heartRate ? parseInt(ecgForm.heartRate) : null,
        rhythm: ecgForm.rhythm, interpretation: ecgForm.interpretation,
        notes: ecgForm.notes, isAbnormal: ecgForm.isAbnormal,
      }, ...prev]);
    }
    setEcgForm({ heartRate: "", rhythm: "normal_sinus", interpretation: "", notes: "", isAbnormal: false });
    setShowEcgForm(false);
  };

  const handleAddBp = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !bpForm.systolic || !bpForm.diastolic) return;
    const newId = await createBloodPressureReading({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      systolic: parseInt(bpForm.systolic), diastolic: parseInt(bpForm.diastolic),
      heart_rate: bpForm.heartRate ? parseInt(bpForm.heartRate) : undefined,
      position: bpForm.position, arm: bpForm.arm, notes: bpForm.notes,
    });
    if (newId) {
      setBpReadings((prev) => [{
        id: newId, patientId: user.id,
        systolic: parseInt(bpForm.systolic), diastolic: parseInt(bpForm.diastolic),
        heartRate: bpForm.heartRate ? parseInt(bpForm.heartRate) : null,
        readingDate: new Date().toISOString().split("T")[0],
        position: bpForm.position, arm: bpForm.arm, notes: bpForm.notes,
      }, ...prev]);
    }
    setBpForm({ systolic: "", diastolic: "", heartRate: "", position: "sitting", arm: "left", notes: "" });
    setShowBpForm(false);
  };

  const handleAddNote = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !noteForm.title) return;
    const newId = await createHeartMonitoringNote({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      title: noteForm.title, content: noteForm.content,
      category: noteForm.category, severity: noteForm.severity, is_alert: noteForm.isAlert,
    });
    if (newId) {
      setHeartNotes((prev) => [{
        id: newId, patientId: user.id, noteDate: new Date().toISOString().split("T")[0],
        category: noteForm.category, title: noteForm.title, content: noteForm.content,
        severity: noteForm.severity, isAlert: noteForm.isAlert,
      }, ...prev]);
    }
    setNoteForm({ title: "", content: "", category: "general", severity: "normal", isAlert: false });
    setShowNoteForm(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cardiology</h1>

      <Tabs defaultValue="ecg">
        <TabsList className="mb-4">
          <TabsTrigger value="ecg">ECG Records</TabsTrigger>
          <TabsTrigger value="bp">Blood Pressure</TabsTrigger>
          <TabsTrigger value="monitoring">Heart Monitoring</TabsTrigger>
        </TabsList>

        {/* ECG RECORDS TAB */}
        <TabsContent value="ecg">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowEcgForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add ECG Record
            </Button>
          </div>

          {ecgs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No ECG records yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {ecgs.map((ecg) => (
                <Card key={ecg.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-red-500" />
                        <span className="font-medium text-sm">{ecg.recordDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {ecg.isAbnormal && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Abnormal
                          </Badge>
                        )}
                        {ecg.heartRate && (
                          <Badge variant="outline">
                            <Heart className="h-3 w-3 mr-1" /> {ecg.heartRate} bpm
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Rhythm:</span> {ecg.rhythm || "—"}</div>
                      <div><span className="text-muted-foreground">Interpretation:</span> {ecg.interpretation || "—"}</div>
                    </div>
                    {ecg.notes && <p className="text-sm text-muted-foreground mt-2">{ecg.notes}</p>}
                    {ecg.fileUrl && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" /> File attached
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* BLOOD PRESSURE TAB */}
        <TabsContent value="bp">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowBpForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Reading
            </Button>
          </div>

          {/* BP Summary Cards */}
          {bpReadings.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Latest</p>
                  <p className="text-2xl font-bold">{bpReadings[0].systolic}/{bpReadings[0].diastolic}</p>
                  <p className={`text-xs font-medium ${bpCategory(bpReadings[0].systolic, bpReadings[0].diastolic).color}`}>
                    {bpCategory(bpReadings[0].systolic, bpReadings[0].diastolic).label}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Average Systolic</p>
                  <p className="text-2xl font-bold">
                    {Math.round(bpReadings.reduce((sum, r) => sum + r.systolic, 0) / bpReadings.length)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Average Diastolic</p>
                  <p className="text-2xl font-bold">
                    {Math.round(bpReadings.reduce((sum, r) => sum + r.diastolic, 0) / bpReadings.length)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* BP History Chart (simplified) */}
          {bpReadings.length > 0 && (
            <Card className="mb-4">
              <CardHeader><CardTitle className="text-sm">Blood Pressure History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bpReadings.slice(0, 10).map((bp) => {
                    const cat = bpCategory(bp.systolic, bp.diastolic);
                    return (
                      <div key={bp.id} className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground w-24">{bp.readingDate}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="h-2 rounded-full bg-red-200" style={{ width: `${(bp.systolic / 200) * 100}%` }} />
                          <span className="font-medium">{bp.systolic}</span>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="h-2 rounded-full bg-blue-200" style={{ width: `${(bp.diastolic / 120) * 100}%` }} />
                          <span className="font-medium">{bp.diastolic}</span>
                        </div>
                        <span className={`text-xs ${cat.color}`}>{cat.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {bpReadings.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Heart className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No blood pressure readings recorded.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HEART MONITORING TAB */}
        <TabsContent value="monitoring">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowNoteForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Note
            </Button>
          </div>

          {heartNotes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No monitoring notes.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {heartNotes.map((note) => (
                <Card key={note.id} className={note.isAlert ? "border-red-200" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm">{note.title}</h3>
                      <div className="flex items-center gap-2">
                        {note.isAlert && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Alert
                          </Badge>
                        )}
                        <Badge variant="outline">{note.category}</Badge>
                        <span className="text-xs text-muted-foreground">{note.noteDate}</span>
                      </div>
                    </div>
                    {note.content && <p className="text-sm text-muted-foreground">{note.content}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ECG Form Dialog */}
      <Dialog open={showEcgForm} onOpenChange={setShowEcgForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add ECG Record</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Heart Rate (bpm)</Label>
                <Input type="number" placeholder="72" value={ecgForm.heartRate}
                  onChange={(e) => setEcgForm((p) => ({ ...p, heartRate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Rhythm</Label>
                <Select value={ecgForm.rhythm} onValueChange={(v) => setEcgForm((p) => ({ ...p, rhythm: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal_sinus">Normal Sinus</SelectItem>
                    <SelectItem value="sinus_tachycardia">Sinus Tachycardia</SelectItem>
                    <SelectItem value="sinus_bradycardia">Sinus Bradycardia</SelectItem>
                    <SelectItem value="atrial_fibrillation">Atrial Fibrillation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Interpretation</Label>
              <Textarea placeholder="ECG interpretation..." value={ecgForm.interpretation}
                onChange={(e) => setEcgForm((p) => ({ ...p, interpretation: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={ecgForm.notes}
                onChange={(e) => setEcgForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="abnormal" checked={ecgForm.isAbnormal}
                onChange={(e) => setEcgForm((p) => ({ ...p, isAbnormal: e.target.checked }))} />
              <Label htmlFor="abnormal" className="text-sm">Mark as abnormal</Label>
            </div>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Attach ECG File</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs">Browse</Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEcgForm(false)}>Cancel</Button>
              <Button onClick={handleAddEcg}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* BP Form Dialog */}
      <Dialog open={showBpForm} onOpenChange={setShowBpForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Blood Pressure Reading</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Systolic</Label>
                <Input type="number" placeholder="120" value={bpForm.systolic}
                  onChange={(e) => setBpForm((p) => ({ ...p, systolic: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Diastolic</Label>
                <Input type="number" placeholder="80" value={bpForm.diastolic}
                  onChange={(e) => setBpForm((p) => ({ ...p, diastolic: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Heart Rate</Label>
                <Input type="number" placeholder="72" value={bpForm.heartRate}
                  onChange={(e) => setBpForm((p) => ({ ...p, heartRate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={bpForm.position} onValueChange={(v) => setBpForm((p) => ({ ...p, position: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sitting">Sitting</SelectItem>
                    <SelectItem value="standing">Standing</SelectItem>
                    <SelectItem value="lying">Lying Down</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Arm</Label>
                <Select value={bpForm.arm} onValueChange={(v) => setBpForm((p) => ({ ...p, arm: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={bpForm.notes}
                onChange={(e) => setBpForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowBpForm(false)}>Cancel</Button>
              <Button onClick={handleAddBp}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Heart Monitoring Note Dialog */}
      <Dialog open={showNoteForm} onOpenChange={setShowNoteForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Monitoring Note</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Note title..." value={noteForm.title}
                onChange={(e) => setNoteForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={noteForm.category} onValueChange={(v) => setNoteForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="arrhythmia">Arrhythmia</SelectItem>
                    <SelectItem value="heart_failure">Heart Failure</SelectItem>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="lifestyle">Lifestyle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={noteForm.severity} onValueChange={(v) => setNoteForm((p) => ({ ...p, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea placeholder="Monitoring notes..." value={noteForm.content}
                onChange={(e) => setNoteForm((p) => ({ ...p, content: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isAlert" checked={noteForm.isAlert}
                onChange={(e) => setNoteForm((p) => ({ ...p, isAlert: e.target.checked }))} />
              <Label htmlFor="isAlert" className="text-sm">Flag as alert</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNoteForm(false)}>Cancel</Button>
              <Button onClick={handleAddNote}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
