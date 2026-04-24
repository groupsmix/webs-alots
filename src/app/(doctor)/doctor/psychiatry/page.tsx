"use client";

import { useState, useEffect } from "react";
import {
  Brain, Plus, Shield, Lock, Pill, Save,
  AlertTriangle, Eye, EyeOff,
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
  fetchPsychSessionNotes, createPsychSessionNote,
  fetchPsychMedications, createPsychMedication, updatePsychMedication,
  type PsychSessionNoteView, type PsychMedicationView,
} from "@/lib/data/specialists";
import { PageLoader } from "@/components/ui/page-loader";
import { Breadcrumb } from "@/components/ui/breadcrumb";

const MOOD_LABELS = ["", "Very Low", "Low", "Below Average", "Slightly Low", "Neutral", "Slightly Good", "Good", "Very Good", "Excellent", "Outstanding"];

export default function PsychiatryPage() {
  const [sessions, setSessions] = useState<PsychSessionNoteView[]>([]);
  const [medications, setMedications] = useState<PsychMedicationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [revealedNotes, setRevealedNotes] = useState<Set<string>>(new Set());

  const [sessionForm, setSessionForm] = useState({
    sessionType: "individual", moodRating: "5", content: "", observations: "",
    plan: "", isConfidential: true, accessLevel: "doctor_only",
  });
  const [medForm, setMedForm] = useState({
    medicationName: "", dosage: "", frequency: "daily", reason: "", notes: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const [s, m] = await Promise.all([
      fetchPsychSessionNotes(user.clinic_id, user.id),
      fetchPsychMedications(user.clinic_id),
    ]);
      if (controller.signal.aborted) return;
    setSessions(s);
    setMedications(m);
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
    return <PageLoader message="Loading psychiatry records..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const toggleReveal = (id: string) => {
    setRevealedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSession = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const nextNum = sessions.length > 0 ? Math.max(...sessions.map((s) => s.sessionNumber)) + 1 : 1;
    const newId = await createPsychSessionNote({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      session_number: nextNum, session_type: sessionForm.sessionType,
      mood_rating: parseInt(sessionForm.moodRating),
      content: sessionForm.content, observations: sessionForm.observations,
      plan: sessionForm.plan, is_confidential: sessionForm.isConfidential,
      access_level: sessionForm.accessLevel,
    });
    if (newId) {
      setSessions((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        sessionDate: new Date().toISOString().split("T")[0],
        sessionNumber: nextNum, sessionType: sessionForm.sessionType,
        moodRating: parseInt(sessionForm.moodRating),
        content: sessionForm.content, observations: sessionForm.observations,
        plan: sessionForm.plan, isConfidential: sessionForm.isConfidential,
        accessLevel: sessionForm.accessLevel,
      }, ...prev]);
    }
    setSessionForm({ sessionType: "individual", moodRating: "5", content: "", observations: "", plan: "", isConfidential: true, accessLevel: "doctor_only" });
    setShowSessionForm(false);
  };

  const handleAddMed = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !medForm.medicationName) return;
    const newId = await createPsychMedication({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      medication_name: medForm.medicationName, dosage: medForm.dosage,
      frequency: medForm.frequency, reason: medForm.reason, notes: medForm.notes,
    });
    if (newId) {
      setMedications((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        medicationName: medForm.medicationName, dosage: medForm.dosage,
        frequency: medForm.frequency,
        startDate: new Date().toISOString().split("T")[0],
        endDate: "", status: "active", reason: medForm.reason,
        sideEffects: "", notes: medForm.notes, dosageHistory: [],
      }, ...prev]);
    }
    setMedForm({ medicationName: "", dosage: "", frequency: "daily", reason: "", notes: "" });
    setShowMedForm(false);
  };

  const handleMedStatus = async (id: string, status: string) => {
    const endDate = status === "discontinued" || status === "completed"
      ? new Date().toISOString().split("T")[0] : undefined;
    const ok = await updatePsychMedication(id, { status, end_date: endDate });
    if (ok) setMedications((prev) => prev.map((m) =>
      m.id === id ? { ...m, status, endDate: endDate ?? m.endDate } : m
    ));
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Psychiatry</h1>
        <Badge variant="outline" className="gap-1">
          <Shield className="h-3 w-3" /> Enhanced Privacy
        </Badge>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList className="mb-4">
          <TabsTrigger value="sessions">Session Notes</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy Settings</TabsTrigger>
        </TabsList>

        {/* SESSION NOTES TAB */}
        <TabsContent value="sessions">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowSessionForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Session
            </Button>
          </div>

          {sessions.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Brain className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No session notes recorded.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const isRevealed = revealedNotes.has(s.id);
                return (
                  <Card key={s.id} className={s.isConfidential ? "border-amber-200" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Psychiatry" }]} />
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Session #{s.sessionNumber}</span>
                          <Badge variant="outline" className="text-xs">{s.sessionType}</Badge>
                          <span className="text-xs text-muted-foreground">{s.sessionDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.isConfidential && (
                            <Badge variant="outline" className="gap-1 text-amber-600">
                              <Lock className="h-2.5 w-2.5" /> {s.accessLevel.replace(/_/g, " ")}
                            </Badge>
                          )}
                          {s.moodRating && (
                            <Badge variant="outline">
                              Mood: {s.moodRating}/10
                            </Badge>
                          )}
                        </div>
                      </div>

                      {s.isConfidential && !isRevealed ? (
                        <div className="rounded-lg bg-amber-50 p-4 text-center">
                          <Lock className="h-5 w-5 mx-auto text-amber-600 mb-1" />
                          <p className="text-xs text-amber-700 mb-2">Confidential content hidden</p>
                          <Button variant="outline" size="sm" onClick={() => toggleReveal(s.id)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Reveal Notes
                          </Button>
                        </div>
                      ) : (
                        <>
                          {s.isConfidential && (
                            <Button variant="ghost" size="sm" className="mb-2 text-xs" onClick={() => toggleReveal(s.id)}>
                              <EyeOff className="h-3 w-3 mr-1" /> Hide
                            </Button>
                          )}
                          {s.content && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-muted-foreground">Session Content</p>
                              <p className="text-sm">{s.content}</p>
                            </div>
                          )}
                          {s.observations && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-muted-foreground">Observations</p>
                              <p className="text-sm">{s.observations}</p>
                            </div>
                          )}
                          {s.plan && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Plan</p>
                              <p className="text-sm">{s.plan}</p>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* MEDICATIONS TAB */}
        <TabsContent value="medications">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowMedForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Medication
            </Button>
          </div>

          {medications.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <Pill className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No medications tracked.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {medications.map((med) => (
                <Card key={med.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4" />
                        <span className="font-medium">{med.medicationName}</span>
                      </div>
                      <Badge variant={med.status === "active" ? "default" : med.status === "discontinued" ? "destructive" : "success"}>
                        {med.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm mb-2">
                      <div><span className="text-muted-foreground">Dosage:</span> {med.dosage}</div>
                      <div><span className="text-muted-foreground">Frequency:</span> {med.frequency}</div>
                      <div><span className="text-muted-foreground">Started:</span> {med.startDate}</div>
                    </div>
                    {med.reason && <p className="text-sm text-muted-foreground mb-1">Reason: {med.reason}</p>}
                    {med.sideEffects && (
                      <p className="text-sm text-orange-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Side effects: {med.sideEffects}
                      </p>
                    )}
                    {med.dosageHistory.length > 0 && (
                      <div className="mt-2 rounded-lg bg-muted/50 p-2">
                        <p className="text-xs font-medium mb-1">Dosage History</p>
                        {med.dosageHistory.map((h, i) => (
                          <div key={i} className="text-xs flex gap-2">
                            <span className="text-muted-foreground">{h.date}</span>
                            <span>{h.dosage}</span>
                            {h.reason && <span className="text-muted-foreground">— {h.reason}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {med.status === "active" && (
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={() => handleMedStatus(med.id, "discontinued")}>
                          Discontinue
                        </Button>
                        <Button variant="outline" size="sm" className="text-green-600" onClick={() => handleMedStatus(med.id, "completed")}>
                          Complete Course
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* PRIVACY TAB */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Privacy Controls
            </CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg bg-amber-50 p-4">
                  <h3 className="text-sm font-medium text-amber-800 flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4" /> Record Visibility
                  </h3>
                  <p className="text-sm text-amber-700">
                    Psychiatric records have enhanced privacy controls. By default, session notes
                    are marked as confidential and visible only to the treating doctor.
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Access Levels</h3>
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <Lock className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">Doctor Only</p>
                        <p className="text-xs text-muted-foreground">Only the treating psychiatrist can view notes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <Shield className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">Care Team</p>
                        <p className="text-xs text-muted-foreground">Visible to authorized members of the care team</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <Eye className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">Full Access</p>
                        <p className="text-xs text-muted-foreground">Visible to all clinic staff with patient access</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Total confidential records: {sessions.filter((s) => s.isConfidential).length}</p>
                  <p>Doctor-only records: {sessions.filter((s) => s.accessLevel === "doctor_only").length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Session Form Dialog */}
      <Dialog open={showSessionForm} onOpenChange={setShowSessionForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Session Note</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Session Type</Label>
                <Select value={sessionForm.sessionType} onValueChange={(v) => setSessionForm((p) => ({ ...p, sessionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="crisis">Crisis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mood Rating (1-10)</Label>
                <Input type="number" min="1" max="10" value={sessionForm.moodRating}
                  onChange={(e) => setSessionForm((p) => ({ ...p, moodRating: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  {MOOD_LABELS[parseInt(sessionForm.moodRating)] ?? ""}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Session Content</Label>
              <Textarea rows={3} placeholder="Session content..." value={sessionForm.content}
                onChange={(e) => setSessionForm((p) => ({ ...p, content: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Observations</Label>
              <Textarea rows={2} placeholder="Clinical observations..." value={sessionForm.observations}
                onChange={(e) => setSessionForm((p) => ({ ...p, observations: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Textarea rows={2} placeholder="Treatment plan..." value={sessionForm.plan}
                onChange={(e) => setSessionForm((p) => ({ ...p, plan: e.target.value }))} />
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Privacy Settings
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="confidential" checked={sessionForm.isConfidential}
                    onChange={(e) => setSessionForm((p) => ({ ...p, isConfidential: e.target.checked }))} />
                  <Label htmlFor="confidential" className="text-sm">Confidential</Label>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Access Level</Label>
                  <Select value={sessionForm.accessLevel} onValueChange={(v) => setSessionForm((p) => ({ ...p, accessLevel: v }))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor_only">Doctor Only</SelectItem>
                      <SelectItem value="care_team">Care Team</SelectItem>
                      <SelectItem value="full">Full Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSessionForm(false)}>Cancel</Button>
              <Button onClick={handleAddSession}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Medication Form Dialog */}
      <Dialog open={showMedForm} onOpenChange={setShowMedForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Medication</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Medication Name</Label>
              <Input placeholder="e.g., Sertraline, Lithium" value={medForm.medicationName}
                onChange={(e) => setMedForm((p) => ({ ...p, medicationName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dosage</Label>
                <Input placeholder="e.g., 50mg" value={medForm.dosage}
                  onChange={(e) => setMedForm((p) => ({ ...p, dosage: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={medForm.frequency} onValueChange={(v) => setMedForm((p) => ({ ...p, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="twice_daily">Twice Daily</SelectItem>
                    <SelectItem value="three_daily">Three Times Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="as_needed">As Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input placeholder="Indication..." value={medForm.reason}
                onChange={(e) => setMedForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={medForm.notes}
                onChange={(e) => setMedForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowMedForm(false)}>Cancel</Button>
              <Button onClick={handleAddMed}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
