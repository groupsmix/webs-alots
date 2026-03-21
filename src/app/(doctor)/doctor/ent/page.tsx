"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Ear, Plus, Save, ClipboardList,
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
  fetchHearingTests, createHearingTest,
  fetchENTExams, createENTExam,
  type HearingTestView, type ENTExamView,
} from "@/lib/data/specialists";

const AUDIOGRAM_FREQUENCIES = ["250", "500", "1000", "2000", "4000", "8000"];

const ENT_TEMPLATES = [
  { value: "ear_exam", label: "Ear Examination" },
  { value: "nose_exam", label: "Nasal Examination" },
  { value: "throat_exam", label: "Throat Examination" },
  { value: "full_ent", label: "Full ENT Examination" },
  { value: "tinnitus", label: "Tinnitus Assessment" },
  { value: "vertigo", label: "Vertigo Assessment" },
  { value: "voice", label: "Voice Assessment" },
];

const TEMPLATE_FIELDS: Record<string, string[]> = {
  ear_exam: ["External Ear", "Ear Canal", "Tympanic Membrane", "Middle Ear", "Hearing Assessment"],
  nose_exam: ["External Nose", "Nasal Cavity", "Septum", "Turbinates", "Sinuses"],
  throat_exam: ["Oral Cavity", "Pharynx", "Tonsils", "Larynx", "Neck"],
  full_ent: ["Ears", "Nose", "Throat", "Neck", "Cranial Nerves"],
  tinnitus: ["Onset", "Character", "Severity", "Associated Symptoms", "Impact on Daily Life"],
  vertigo: ["Onset", "Duration", "Triggers", "Associated Symptoms", "Dix-Hallpike Test"],
  voice: ["Voice Quality", "Pitch", "Volume", "Vocal Cord Mobility", "Laryngoscopy Findings"],
};

export default function ENTPage() {
  const [hearingTests, setHearingTests] = useState<HearingTestView[]>([]);
  const [exams, setExams] = useState<ENTExamView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTestForm, setShowTestForm] = useState(false);
  const [showExamForm, setShowExamForm] = useState(false);

  const [testForm, setTestForm] = useState({
    testType: "pure_tone",
    leftEar: {} as Record<string, string>,
    rightEar: {} as Record<string, string>,
    interpretation: "",
    hearingLossType: "",
    hearingLossDegree: "",
    notes: "",
  });
  const [examForm, setExamForm] = useState({
    templateType: "ear_exam",
    findings: {} as Record<string, string>,
    diagnosis: "",
    plan: "",
  });

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [t, e] = await Promise.all([
      fetchHearingTests(user.clinic_id),
      fetchENTExams(user.clinic_id),
    ]);
    setHearingTests(t);
    setExams(e);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading ENT records...</p>
      </div>
    );
  }

  const handleAddTest = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const leftData: Record<string, number> = {};
    const rightData: Record<string, number> = {};
    for (const f of AUDIOGRAM_FREQUENCIES) {
      if (testForm.leftEar[f]) leftData[f] = parseInt(testForm.leftEar[f]);
      if (testForm.rightEar[f]) rightData[f] = parseInt(testForm.rightEar[f]);
    }
    const newId = await createHearingTest({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      test_type: testForm.testType, left_ear_data: leftData, right_ear_data: rightData,
      interpretation: testForm.interpretation, hearing_loss_type: testForm.hearingLossType,
      hearing_loss_degree: testForm.hearingLossDegree, notes: testForm.notes,
    });
    if (newId) {
      setHearingTests((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        testDate: new Date().toISOString().split("T")[0],
        testType: testForm.testType, leftEarData: leftData, rightEarData: rightData,
        interpretation: testForm.interpretation, hearingLossType: testForm.hearingLossType,
        hearingLossDegree: testForm.hearingLossDegree, notes: testForm.notes,
      }, ...prev]);
    }
    setTestForm({ testType: "pure_tone", leftEar: {}, rightEar: {}, interpretation: "", hearingLossType: "", hearingLossDegree: "", notes: "" });
    setShowTestForm(false);
  };

  const handleAddExam = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const newId = await createENTExam({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      template_type: examForm.templateType, findings: examForm.findings,
      diagnosis: examForm.diagnosis, plan: examForm.plan,
    });
    if (newId) {
      setExams((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        examDate: new Date().toISOString().split("T")[0],
        templateType: examForm.templateType, findings: examForm.findings,
        diagnosis: examForm.diagnosis, plan: examForm.plan,
      }, ...prev]);
    }
    setExamForm({ templateType: "ear_exam", findings: {}, diagnosis: "", plan: "" });
    setShowExamForm(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ENT Specialist</h1>

      <Tabs defaultValue="hearing">
        <TabsList className="mb-4">
          <TabsTrigger value="hearing">Hearing Tests</TabsTrigger>
          <TabsTrigger value="exams">ENT Exams</TabsTrigger>
        </TabsList>

        {/* HEARING TESTS TAB */}
        <TabsContent value="hearing">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowTestForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Hearing Test
            </Button>
          </div>

          {hearingTests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Ear className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No hearing tests recorded.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {hearingTests.map((test) => (
                <Card key={test.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Ear className="h-4 w-4" />
                        {test.testType.replace(/_/g, " ")} — {test.testDate}
                      </CardTitle>
                      <div className="flex gap-2">
                        {test.hearingLossType && <Badge variant="outline">{test.hearingLossType}</Badge>}
                        {test.hearingLossDegree && <Badge variant="outline">{test.hearingLossDegree}</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Audiogram Data */}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs font-medium mb-2">Left Ear (dB HL)</p>
                        <div className="grid grid-cols-3 gap-1">
                          {AUDIOGRAM_FREQUENCIES.map((f) => (
                            <div key={f} className="text-center">
                              <span className="text-[10px] text-muted-foreground">{f}Hz</span>
                              <p className="text-sm font-medium">{test.leftEarData[f] ?? "—"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-2">Right Ear (dB HL)</p>
                        <div className="grid grid-cols-3 gap-1">
                          {AUDIOGRAM_FREQUENCIES.map((f) => (
                            <div key={f} className="text-center">
                              <span className="text-[10px] text-muted-foreground">{f}Hz</span>
                              <p className="text-sm font-medium">{test.rightEarData[f] ?? "—"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {test.interpretation && (
                      <p className="text-sm text-muted-foreground">{test.interpretation}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ENT EXAMS TAB */}
        <TabsContent value="exams">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowExamForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Exam
            </Button>
          </div>

          {exams.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No ENT exams recorded.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <Card key={exam.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {ENT_TEMPLATES.find((t) => t.value === exam.templateType)?.label ?? exam.templateType}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{exam.examDate}</span>
                    </div>
                    {Object.entries(exam.findings).length > 0 && (
                      <div className="rounded-lg bg-muted/50 p-3 mb-2">
                        {Object.entries(exam.findings).map(([key, value]) => (
                          <div key={key} className="text-sm flex gap-2">
                            <span className="font-medium">{key}:</span>
                            <span className="text-muted-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {exam.diagnosis && (
                      <p className="text-sm"><span className="font-medium">Diagnosis:</span> {exam.diagnosis}</p>
                    )}
                    {exam.plan && (
                      <p className="text-sm text-muted-foreground mt-1"><span className="font-medium">Plan:</span> {exam.plan}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Hearing Test Dialog */}
      <Dialog open={showTestForm} onOpenChange={setShowTestForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Hearing Test</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Test Type</Label>
              <Select value={testForm.testType} onValueChange={(v) => setTestForm((p) => ({ ...p, testType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pure_tone">Pure Tone Audiometry</SelectItem>
                  <SelectItem value="speech">Speech Audiometry</SelectItem>
                  <SelectItem value="tympanometry">Tympanometry</SelectItem>
                  <SelectItem value="oae">OAE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Left Ear (dB HL)</Label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {AUDIOGRAM_FREQUENCIES.map((f) => (
                    <div key={f}>
                      <Label className="text-[10px]">{f}Hz</Label>
                      <Input type="number" className="h-7 text-xs" placeholder="dB"
                        value={testForm.leftEar[f] ?? ""}
                        onChange={(e) => setTestForm((p) => ({
                          ...p, leftEar: { ...p.leftEar, [f]: e.target.value },
                        }))} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Right Ear (dB HL)</Label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {AUDIOGRAM_FREQUENCIES.map((f) => (
                    <div key={f}>
                      <Label className="text-[10px]">{f}Hz</Label>
                      <Input type="number" className="h-7 text-xs" placeholder="dB"
                        value={testForm.rightEar[f] ?? ""}
                        onChange={(e) => setTestForm((p) => ({
                          ...p, rightEar: { ...p.rightEar, [f]: e.target.value },
                        }))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Loss Type</Label>
                <Select value={testForm.hearingLossType} onValueChange={(v) => setTestForm((p) => ({ ...p, hearingLossType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="conductive">Conductive</SelectItem>
                    <SelectItem value="sensorineural">Sensorineural</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Degree</Label>
                <Select value={testForm.hearingLossDegree} onValueChange={(v) => setTestForm((p) => ({ ...p, hearingLossDegree: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                    <SelectItem value="profound">Profound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Interpretation</Label>
              <Textarea placeholder="Test interpretation..." value={testForm.interpretation}
                onChange={(e) => setTestForm((p) => ({ ...p, interpretation: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowTestForm(false)}>Cancel</Button>
              <Button onClick={handleAddTest}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ENT Exam Dialog */}
      <Dialog open={showExamForm} onOpenChange={setShowExamForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New ENT Exam</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={examForm.templateType} onValueChange={(v) => setExamForm((p) => ({
                ...p, templateType: v, findings: {},
              }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENT_TEMPLATES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Findings</Label>
              {(TEMPLATE_FIELDS[examForm.templateType] ?? []).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{field}</Label>
                  <Input placeholder={`${field} findings...`}
                    value={examForm.findings[field] ?? ""}
                    onChange={(e) => setExamForm((p) => ({
                      ...p, findings: { ...p.findings, [field]: e.target.value },
                    }))} />
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
