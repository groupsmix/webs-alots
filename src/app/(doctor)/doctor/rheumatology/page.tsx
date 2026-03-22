"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Save, Activity, Target,
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
  fetchJointAssessments, createJointAssessment,
  fetchMobilityTests, createMobilityTest,
  type JointAssessmentView, type MobilityTestView,
} from "@/lib/data/specialists";
import { PageLoader } from "@/components/ui/page-loader";

const JOINTS = [
  "Left Shoulder", "Right Shoulder", "Left Elbow", "Right Elbow",
  "Left Wrist", "Right Wrist", "Left Hip", "Right Hip",
  "Left Knee", "Right Knee", "Left Ankle", "Right Ankle",
  "Left MCP", "Right MCP", "Left PIP", "Right PIP",
];

const MOBILITY_TEST_TYPES = [
  { value: "rom", label: "Range of Motion" },
  { value: "strength", label: "Muscle Strength" },
  { value: "functional", label: "Functional Assessment" },
  { value: "grip", label: "Grip Strength" },
  { value: "walk", label: "Timed Walk" },
];

function vasColor(score: number): string {
  if (score <= 3) return "text-green-600";
  if (score <= 6) return "text-yellow-600";
  return "text-red-600";
}

export default function RheumatologyPage() {
  const [assessments, setAssessments] = useState<JointAssessmentView[]>([]);
  const [mobilityTests, setMobilityTests] = useState<MobilityTestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [showMobilityForm, setShowMobilityForm] = useState(false);

  const [assessmentForm, setAssessmentForm] = useState({
    jointsData: {} as Record<string, { swollen: boolean; tender: boolean }>,
    vasPainScore: "", morningStiffnessMinutes: "", functionalStatus: "", notes: "",
  });
  const [mobilityForm, setMobilityForm] = useState({
    testType: "rom", joint: "", rangeOfMotion: {} as Record<string, string>,
    strengthScore: "", painDuringTest: "", notes: "",
  });

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [a, m] = await Promise.all([
      fetchJointAssessments(user.clinic_id),
      fetchMobilityTests(user.clinic_id),
    ]);
    setAssessments(a);
    setMobilityTests(m);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return <PageLoader message="Loading rheumatology records..." />;
  }

  const handleAddAssessment = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const swollenCount = Object.values(assessmentForm.jointsData).filter((j) => j.swollen).length;
    const tenderCount = Object.values(assessmentForm.jointsData).filter((j) => j.tender).length;
    const newId = await createJointAssessment({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      joints_data: assessmentForm.jointsData,
      vas_pain_score: assessmentForm.vasPainScore ? parseInt(assessmentForm.vasPainScore) : undefined,
      morning_stiffness_minutes: assessmentForm.morningStiffnessMinutes ? parseInt(assessmentForm.morningStiffnessMinutes) : undefined,
      swollen_joint_count: swollenCount, tender_joint_count: tenderCount,
      functional_status: assessmentForm.functionalStatus, notes: assessmentForm.notes,
    });
    if (newId) {
      setAssessments((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        assessmentDate: new Date().toISOString().split("T")[0],
        jointsData: assessmentForm.jointsData,
        vasPainScore: assessmentForm.vasPainScore ? parseInt(assessmentForm.vasPainScore) : null,
        morningStiffnessMinutes: assessmentForm.morningStiffnessMinutes ? parseInt(assessmentForm.morningStiffnessMinutes) : null,
        swollenJointCount: swollenCount, tenderJointCount: tenderCount,
        das28Score: null, functionalStatus: assessmentForm.functionalStatus,
        notes: assessmentForm.notes,
      }, ...prev]);
    }
    setAssessmentForm({ jointsData: {}, vasPainScore: "", morningStiffnessMinutes: "", functionalStatus: "", notes: "" });
    setShowAssessmentForm(false);
  };

  const handleAddMobility = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !mobilityForm.joint) return;
    const rom: Record<string, number> = {};
    for (const [k, v] of Object.entries(mobilityForm.rangeOfMotion)) {
      if (v) rom[k] = parseInt(v);
    }
    const newId = await createMobilityTest({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      test_type: mobilityForm.testType, joint: mobilityForm.joint,
      range_of_motion: rom,
      strength_score: mobilityForm.strengthScore ? parseInt(mobilityForm.strengthScore) : undefined,
      pain_during_test: mobilityForm.painDuringTest ? parseInt(mobilityForm.painDuringTest) : undefined,
      notes: mobilityForm.notes,
    });
    if (newId) {
      setMobilityTests((prev) => [{
        id: newId, patientId: user.id,
        testDate: new Date().toISOString().split("T")[0],
        testType: mobilityForm.testType, joint: mobilityForm.joint,
        rangeOfMotion: rom,
        strengthScore: mobilityForm.strengthScore ? parseInt(mobilityForm.strengthScore) : null,
        painDuringTest: mobilityForm.painDuringTest ? parseInt(mobilityForm.painDuringTest) : null,
        notes: mobilityForm.notes,
      }, ...prev]);
    }
    setMobilityForm({ testType: "rom", joint: "", rangeOfMotion: {}, strengthScore: "", painDuringTest: "", notes: "" });
    setShowMobilityForm(false);
  };

  const toggleJoint = (joint: string, field: "swollen" | "tender") => {
    setAssessmentForm((prev) => {
      const current = prev.jointsData[joint] ?? { swollen: false, tender: false };
      return {
        ...prev,
        jointsData: { ...prev.jointsData, [joint]: { ...current, [field]: !current[field] } },
      };
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Rheumatology</h1>

      <Tabs defaultValue="assessments">
        <TabsList className="mb-4">
          <TabsTrigger value="assessments">Joint Assessments</TabsTrigger>
          <TabsTrigger value="mobility">Mobility Tests</TabsTrigger>
        </TabsList>

        {/* JOINT ASSESSMENTS TAB */}
        <TabsContent value="assessments">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowAssessmentForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Assessment
            </Button>
          </div>

          {assessments.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No joint assessments recorded.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {assessments.map((a) => (
                <Card key={a.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        Joint Assessment — {a.assessmentDate}
                      </CardTitle>
                      <div className="flex gap-2">
                        {a.vasPainScore !== null && (
                          <Badge variant="outline" className={vasColor(a.vasPainScore)}>
                            VAS: {a.vasPainScore}/10
                          </Badge>
                        )}
                        {a.das28Score !== null && (
                          <Badge variant="outline">DAS28: {a.das28Score}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-3 text-sm mb-3">
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-xs text-muted-foreground">Swollen</p>
                        <p className="text-lg font-bold text-red-600">{a.swollenJointCount}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-xs text-muted-foreground">Tender</p>
                        <p className="text-lg font-bold text-orange-600">{a.tenderJointCount}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-xs text-muted-foreground">Morning Stiffness</p>
                        <p className="text-lg font-bold">{a.morningStiffnessMinutes ?? "—"} min</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-xs text-muted-foreground">Functional Status</p>
                        <p className="text-sm font-medium">{a.functionalStatus || "—"}</p>
                      </div>
                    </div>

                    {/* Joint Diagram */}
                    {Object.keys(a.jointsData).length > 0 && (
                      <div className="rounded-lg border p-3 mb-3">
                        <p className="text-xs font-medium mb-2">Affected Joints</p>
                        <div className="grid grid-cols-4 gap-1">
                          {Object.entries(a.jointsData).map(([joint, data]) => (
                            <div key={joint} className="text-xs flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${
                                data.swollen && data.tender ? "bg-red-500" :
                                data.swollen ? "bg-orange-500" :
                                data.tender ? "bg-yellow-500" : "bg-gray-300"
                              }`} />
                              <span>{joint}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Both</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Swollen</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Tender</span>
                        </div>
                      </div>
                    )}
                    {a.notes && <p className="text-sm text-muted-foreground">{a.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MOBILITY TESTS TAB */}
        <TabsContent value="mobility">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowMobilityForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Test
            </Button>
          </div>

          {mobilityTests.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No mobility tests recorded.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {mobilityTests.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {MOBILITY_TEST_TYPES.find((mt) => mt.value === t.testType)?.label ?? t.testType}
                        </span>
                        <Badge variant="outline" className="text-xs">{t.joint}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{t.testDate}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm mb-2">
                      {Object.entries(t.rangeOfMotion).length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Range of Motion</p>
                          {Object.entries(t.rangeOfMotion).map(([k, v]) => (
                            <div key={k} className="text-xs">{k}: {v}°</div>
                          ))}
                        </div>
                      )}
                      {t.strengthScore !== null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Strength</p>
                          <p className="font-medium">{t.strengthScore}/5</p>
                        </div>
                      )}
                      {t.painDuringTest !== null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Pain During Test</p>
                          <p className={`font-medium ${vasColor(t.painDuringTest)}`}>{t.painDuringTest}/10</p>
                        </div>
                      )}
                    </div>
                    {t.notes && <p className="text-sm text-muted-foreground">{t.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Joint Assessment Form */}
      <Dialog open={showAssessmentForm} onOpenChange={setShowAssessmentForm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Joint Assessment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Joint Tracking Diagram */}
            <div className="space-y-2">
              <Label>Joint Tracking (click to toggle)</Label>
              <div className="grid grid-cols-2 gap-2">
                {JOINTS.map((joint) => {
                  const data = assessmentForm.jointsData[joint];
                  return (
                    <div key={joint} className="flex items-center gap-2 p-2 rounded border text-sm">
                      <span className="flex-1">{joint}</span>
                      <Button
                        variant={data?.swollen ? "destructive" : "outline"}
                        size="sm" className="h-6 text-xs px-2"
                        onClick={() => toggleJoint(joint, "swollen")}
                      >S</Button>
                      <Button
                        variant={data?.tender ? "default" : "outline"}
                        size="sm" className="h-6 text-xs px-2"
                        onClick={() => toggleJoint(joint, "tender")}
                      >T</Button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>S = Swollen</span>
                <span>T = Tender</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>VAS Pain Score (0-10)</Label>
                <Input type="number" min="0" max="10" value={assessmentForm.vasPainScore}
                  onChange={(e) => setAssessmentForm((p) => ({ ...p, vasPainScore: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Morning Stiffness (min)</Label>
                <Input type="number" placeholder="30" value={assessmentForm.morningStiffnessMinutes}
                  onChange={(e) => setAssessmentForm((p) => ({ ...p, morningStiffnessMinutes: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Functional Status</Label>
                <Select value={assessmentForm.functionalStatus} onValueChange={(v) => setAssessmentForm((p) => ({ ...p, functionalStatus: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class_1">Class I - Normal</SelectItem>
                    <SelectItem value="class_2">Class II - Mild limitation</SelectItem>
                    <SelectItem value="class_3">Class III - Moderate limitation</SelectItem>
                    <SelectItem value="class_4">Class IV - Severe limitation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Clinical notes..." value={assessmentForm.notes}
                onChange={(e) => setAssessmentForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAssessmentForm(false)}>Cancel</Button>
              <Button onClick={handleAddAssessment}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobility Test Form */}
      <Dialog open={showMobilityForm} onOpenChange={setShowMobilityForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Mobility Test</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Test Type</Label>
                <Select value={mobilityForm.testType} onValueChange={(v) => setMobilityForm((p) => ({ ...p, testType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOBILITY_TEST_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Joint</Label>
                <Select value={mobilityForm.joint} onValueChange={(v) => setMobilityForm((p) => ({ ...p, joint: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {JOINTS.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Range of Motion (degrees)</Label>
              <div className="grid grid-cols-2 gap-2">
                {["Flexion", "Extension", "Abduction", "Adduction"].map((m) => (
                  <div key={m} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{m}</Label>
                    <Input type="number" placeholder="°" className="h-7 text-xs"
                      value={mobilityForm.rangeOfMotion[m] ?? ""}
                      onChange={(e) => setMobilityForm((p) => ({
                        ...p, rangeOfMotion: { ...p.rangeOfMotion, [m]: e.target.value },
                      }))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Strength Score (0-5)</Label>
                <Input type="number" min="0" max="5" value={mobilityForm.strengthScore}
                  onChange={(e) => setMobilityForm((p) => ({ ...p, strengthScore: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Pain During Test (0-10)</Label>
                <Input type="number" min="0" max="10" value={mobilityForm.painDuringTest}
                  onChange={(e) => setMobilityForm((p) => ({ ...p, painDuringTest: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Test notes..." value={mobilityForm.notes}
                onChange={(e) => setMobilityForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowMobilityForm(false)}>Cancel</Button>
              <Button onClick={handleAddMobility}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
