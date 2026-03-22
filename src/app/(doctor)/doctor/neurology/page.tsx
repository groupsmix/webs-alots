"use client";

import { useState, useEffect } from "react";
import {
  Brain, Plus, FileText, Save, Activity,
  AlertTriangle, ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCurrentUser } from "@/lib/data/client";
import {
  fetchEEGRecords, createEEGRecord,
  fetchNeuroExams, createNeuroExam,
  type EEGRecordView, type NeuroExamView,
} from "@/lib/data/specialists";
import { PageLoader } from "@/components/ui/page-loader";

const NEURO_EXAM_SECTIONS = [
  { key: "mentalStatus", label: "Mental Status", fields: ["Orientation", "Attention", "Memory", "Language", "Calculation"] },
  { key: "cranialNerves", label: "Cranial Nerves", fields: ["CN I (Olfactory)", "CN II (Optic)", "CN III/IV/VI (Eye Movement)", "CN V (Trigeminal)", "CN VII (Facial)", "CN VIII (Vestibulocochlear)", "CN IX/X (Glossopharyngeal/Vagus)", "CN XI (Accessory)", "CN XII (Hypoglossal)"] },
  { key: "motorFunction", label: "Motor Function", fields: ["Upper Extremity Strength", "Lower Extremity Strength", "Muscle Tone", "Bulk", "Involuntary Movements"] },
  { key: "sensoryFunction", label: "Sensory Function", fields: ["Light Touch", "Pain/Temperature", "Vibration", "Proprioception"] },
  { key: "reflexes", label: "Reflexes", fields: ["Biceps", "Triceps", "Brachioradialis", "Patellar", "Achilles", "Plantar"] },
  { key: "coordination", label: "Coordination", fields: ["Finger-to-Nose", "Heel-to-Shin", "Rapid Alternating", "Romberg"] },
  { key: "gait", label: "Gait", fields: ["Normal Gait", "Tandem Gait", "Heel Walking", "Toe Walking"] },
];

export default function NeurologyPage() {
  const [eegs, setEegs] = useState<EEGRecordView[]>([]);
  const [exams, setExams] = useState<NeuroExamView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEegForm, setShowEegForm] = useState(false);
  const [showExamForm, setShowExamForm] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const [eegForm, setEegForm] = useState({
    durationMinutes: "", findings: "", interpretation: "", notes: "", isAbnormal: false,
  });
  const [examForm, setExamForm] = useState({
    sections: {} as Record<string, Record<string, string>>,
    diagnosis: "", plan: "", notes: "",
  });

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [e, x] = await Promise.all([
      fetchEEGRecords(user.clinic_id),
      fetchNeuroExams(user.clinic_id),
    ]);
    setEegs(e);
    setExams(x);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return <PageLoader message="Loading neurology records..." />;
  }

  const handleAddEeg = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const newId = await createEEGRecord({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      duration_minutes: eegForm.durationMinutes ? parseInt(eegForm.durationMinutes) : undefined,
      findings: eegForm.findings, interpretation: eegForm.interpretation,
      notes: eegForm.notes, is_abnormal: eegForm.isAbnormal,
    });
    if (newId) {
      setEegs((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        recordDate: new Date().toISOString().split("T")[0],
        fileUrl: "", durationMinutes: eegForm.durationMinutes ? parseInt(eegForm.durationMinutes) : null,
        findings: eegForm.findings, interpretation: eegForm.interpretation,
        isAbnormal: eegForm.isAbnormal, notes: eegForm.notes,
      }, ...prev]);
    }
    setEegForm({ durationMinutes: "", findings: "", interpretation: "", notes: "", isAbnormal: false });
    setShowEegForm(false);
  };

  const handleAddExam = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const newId = await createNeuroExam({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      mental_status: examForm.sections["mentalStatus"] ?? {},
      cranial_nerves: examForm.sections["cranialNerves"] ?? {},
      motor_function: examForm.sections["motorFunction"] ?? {},
      sensory_function: examForm.sections["sensoryFunction"] ?? {},
      reflexes: examForm.sections["reflexes"] ?? {},
      coordination: examForm.sections["coordination"] ?? {},
      gait: examForm.sections["gait"] ?? {},
      diagnosis: examForm.diagnosis, plan: examForm.plan, notes: examForm.notes,
    });
    if (newId) {
      setExams((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        examDate: new Date().toISOString().split("T")[0],
        mentalStatus: examForm.sections["mentalStatus"] ?? {},
        cranialNerves: examForm.sections["cranialNerves"] ?? {},
        motorFunction: examForm.sections["motorFunction"] ?? {},
        sensoryFunction: examForm.sections["sensoryFunction"] ?? {},
        reflexes: examForm.sections["reflexes"] ?? {},
        coordination: examForm.sections["coordination"] ?? {},
        gait: examForm.sections["gait"] ?? {},
        diagnosis: examForm.diagnosis, plan: examForm.plan, notes: examForm.notes,
      }, ...prev]);
    }
    setExamForm({ sections: {}, diagnosis: "", plan: "", notes: "" });
    setActiveSection(0);
    setShowExamForm(false);
  };

  const updateExamField = (sectionKey: string, field: string, value: string) => {
    setExamForm((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: { ...(prev.sections[sectionKey] ?? {}), [field]: value },
      },
    }));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Neurology</h1>

      <Tabs defaultValue="eeg">
        <TabsList className="mb-4">
          <TabsTrigger value="eeg">EEG Records</TabsTrigger>
          <TabsTrigger value="exams">Neurological Exams</TabsTrigger>
        </TabsList>

        {/* EEG RECORDS TAB */}
        <TabsContent value="eeg">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowEegForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add EEG Record
            </Button>
          </div>

          {eegs.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No EEG records.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {eegs.map((eeg) => (
                <Card key={eeg.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-purple-500" />
                        <span className="font-medium text-sm">{eeg.recordDate}</span>
                        {eeg.durationMinutes && (
                          <Badge variant="outline" className="text-xs">{eeg.durationMinutes} min</Badge>
                        )}
                      </div>
                      {eeg.isAbnormal && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Abnormal
                        </Badge>
                      )}
                    </div>
                    {eeg.findings && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground">Findings</p>
                        <p className="text-sm">{eeg.findings}</p>
                      </div>
                    )}
                    {eeg.interpretation && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground">Interpretation</p>
                        <p className="text-sm">{eeg.interpretation}</p>
                      </div>
                    )}
                    {eeg.notes && <p className="text-sm text-muted-foreground">{eeg.notes}</p>}
                    {eeg.fileUrl && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        <FileText className="h-3 w-3 mr-1" /> File attached
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* NEUROLOGICAL EXAMS TAB */}
        <TabsContent value="exams">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowExamForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Exam
            </Button>
          </div>

          {exams.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No neurological exams recorded.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {exams.map((exam) => (
                <Card key={exam.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Brain className="h-4 w-4" /> Neurological Exam — {exam.examDate}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {NEURO_EXAM_SECTIONS.map(({ key, label }) => {
                        const data = exam[key as keyof NeuroExamView] as Record<string, string> | undefined;
                        if (!data || Object.keys(data).length === 0) return null;
                        return (
                          <div key={key} className="rounded-lg bg-muted/50 p-3">
                            <p className="text-xs font-medium mb-1">{label}</p>
                            {Object.entries(data).map(([k, v]) => (
                              <div key={k} className="text-xs flex gap-1">
                                <span className="text-muted-foreground">{k}:</span>
                                <span>{v}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    {exam.diagnosis && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground">Diagnosis</p>
                        <p className="text-sm">{exam.diagnosis}</p>
                      </div>
                    )}
                    {exam.plan && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground">Plan</p>
                        <p className="text-sm">{exam.plan}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* EEG Form Dialog */}
      <Dialog open={showEegForm} onOpenChange={setShowEegForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add EEG Record</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input type="number" placeholder="30" value={eegForm.durationMinutes}
                onChange={(e) => setEegForm((p) => ({ ...p, durationMinutes: e.target.value }))} />
            </div>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Attach EEG File</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs">Browse</Button>
            </div>
            <div className="space-y-2">
              <Label>Findings</Label>
              <Textarea placeholder="EEG findings..." value={eegForm.findings}
                onChange={(e) => setEegForm((p) => ({ ...p, findings: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Interpretation</Label>
              <Textarea placeholder="Clinical interpretation..." value={eegForm.interpretation}
                onChange={(e) => setEegForm((p) => ({ ...p, interpretation: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={eegForm.notes}
                onChange={(e) => setEegForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="eegAbnormal" checked={eegForm.isAbnormal}
                onChange={(e) => setEegForm((p) => ({ ...p, isAbnormal: e.target.checked }))} />
              <Label htmlFor="eegAbnormal" className="text-sm">Mark as abnormal</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEegForm(false)}>Cancel</Button>
              <Button onClick={handleAddEeg}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Neuro Exam Form Dialog */}
      <Dialog open={showExamForm} onOpenChange={setShowExamForm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Neurological Examination</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Section Navigation */}
            <div className="flex gap-1 flex-wrap">
              {NEURO_EXAM_SECTIONS.map((s, i) => (
                <Button key={s.key} variant={activeSection === i ? "default" : "outline"} size="sm"
                  className="text-xs" onClick={() => setActiveSection(i)}>
                  {s.label}
                </Button>
              ))}
            </div>

            {/* Active Section Fields */}
            <div className="space-y-2 border rounded-lg p-4">
              <h3 className="text-sm font-medium">{NEURO_EXAM_SECTIONS[activeSection].label}</h3>
              {NEURO_EXAM_SECTIONS[activeSection].fields.map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{field}</Label>
                  <Input
                    placeholder={`${field} findings...`}
                    value={examForm.sections[NEURO_EXAM_SECTIONS[activeSection].key]?.[field] ?? ""}
                    onChange={(e) => updateExamField(NEURO_EXAM_SECTIONS[activeSection].key, field, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea placeholder="Diagnosis..." value={examForm.diagnosis}
                onChange={(e) => setExamForm((p) => ({ ...p, diagnosis: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Textarea placeholder="Treatment plan..." value={examForm.plan}
                onChange={(e) => setExamForm((p) => ({ ...p, plan: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowExamForm(false)}>Cancel</Button>
              <Button onClick={handleAddExam}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
