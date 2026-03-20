"use client";

import { useState } from "react";
import { Activity, Heart, Thermometer, Weight, Droplets, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SessionVitals {
  id: string;
  patientName: string;
  sessionDate: string;
  preWeight: number | null;
  postWeight: number | null;
  preBpSystolic: number | null;
  preBpDiastolic: number | null;
  postBpSystolic: number | null;
  postBpDiastolic: number | null;
  prePulse: number | null;
  postPulse: number | null;
  preTemperature: number | null;
  postTemperature: number | null;
  ufGoal: number | null;
  ufActual: number | null;
  dialysateFlow: number | null;
  bloodFlow: number | null;
  complications: string | null;
  notes: string | null;
}

interface VitalsTrackerProps {
  sessions: SessionVitals[];
  editable?: boolean;
  onSaveVitals?: (sessionId: string, vitals: Partial<SessionVitals>) => void;
}

export function VitalsTracker({ sessions, editable = false, onSaveVitals }: VitalsTrackerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SessionVitals>>({});

  const startEditing = (session: SessionVitals) => {
    setEditingId(session.id);
    setEditForm({
      preWeight: session.preWeight,
      postWeight: session.postWeight,
      preBpSystolic: session.preBpSystolic,
      preBpDiastolic: session.preBpDiastolic,
      postBpSystolic: session.postBpSystolic,
      postBpDiastolic: session.postBpDiastolic,
      prePulse: session.prePulse,
      postPulse: session.postPulse,
      preTemperature: session.preTemperature,
      postTemperature: session.postTemperature,
      ufGoal: session.ufGoal,
      ufActual: session.ufActual,
      dialysateFlow: session.dialysateFlow,
      bloodFlow: session.bloodFlow,
      complications: session.complications,
      notes: session.notes,
    });
  };

  const handleSave = () => {
    if (editingId && onSaveVitals) {
      onSaveVitals(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Activity className="h-5 w-5" />
        Patient Vitals Tracking
      </h2>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No session vitals recorded.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isEditing = editingId === session.id;
            const weightChange = session.preWeight && session.postWeight ? (session.preWeight - session.postWeight).toFixed(1) : null;

            return (
              <Card key={session.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{session.patientName} — {session.sessionDate}</CardTitle>
                    {editable && !isEditing && (
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => startEditing(session)}>
                        Record Vitals
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium mb-2">Pre-Dialysis</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px]">Weight (kg)</Label>
                              <Input type="number" step="0.1" value={editForm.preWeight ?? ""} onChange={(e) => setEditForm({ ...editForm, preWeight: parseFloat(e.target.value) || null })} className="text-sm h-8" />
                            </div>
                            <div>
                              <Label className="text-[10px]">BP (sys/dia)</Label>
                              <div className="flex gap-1">
                                <Input type="number" value={editForm.preBpSystolic ?? ""} onChange={(e) => setEditForm({ ...editForm, preBpSystolic: parseInt(e.target.value) || null })} className="text-sm h-8" placeholder="120" />
                                <Input type="number" value={editForm.preBpDiastolic ?? ""} onChange={(e) => setEditForm({ ...editForm, preBpDiastolic: parseInt(e.target.value) || null })} className="text-sm h-8" placeholder="80" />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px]">Pulse</Label>
                              <Input type="number" value={editForm.prePulse ?? ""} onChange={(e) => setEditForm({ ...editForm, prePulse: parseInt(e.target.value) || null })} className="text-sm h-8" />
                            </div>
                            <div>
                              <Label className="text-[10px]">Temp (&deg;C)</Label>
                              <Input type="number" step="0.1" value={editForm.preTemperature ?? ""} onChange={(e) => setEditForm({ ...editForm, preTemperature: parseFloat(e.target.value) || null })} className="text-sm h-8" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-2">Post-Dialysis</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px]">Weight (kg)</Label>
                              <Input type="number" step="0.1" value={editForm.postWeight ?? ""} onChange={(e) => setEditForm({ ...editForm, postWeight: parseFloat(e.target.value) || null })} className="text-sm h-8" />
                            </div>
                            <div>
                              <Label className="text-[10px]">BP (sys/dia)</Label>
                              <div className="flex gap-1">
                                <Input type="number" value={editForm.postBpSystolic ?? ""} onChange={(e) => setEditForm({ ...editForm, postBpSystolic: parseInt(e.target.value) || null })} className="text-sm h-8" placeholder="120" />
                                <Input type="number" value={editForm.postBpDiastolic ?? ""} onChange={(e) => setEditForm({ ...editForm, postBpDiastolic: parseInt(e.target.value) || null })} className="text-sm h-8" placeholder="80" />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px]">Pulse</Label>
                              <Input type="number" value={editForm.postPulse ?? ""} onChange={(e) => setEditForm({ ...editForm, postPulse: parseInt(e.target.value) || null })} className="text-sm h-8" />
                            </div>
                            <div>
                              <Label className="text-[10px]">Temp (&deg;C)</Label>
                              <Input type="number" step="0.1" value={editForm.postTemperature ?? ""} onChange={(e) => setEditForm({ ...editForm, postTemperature: parseFloat(e.target.value) || null })} className="text-sm h-8" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <Label className="text-[10px]">UF Goal (L)</Label>
                          <Input type="number" step="0.1" value={editForm.ufGoal ?? ""} onChange={(e) => setEditForm({ ...editForm, ufGoal: parseFloat(e.target.value) || null })} className="text-sm h-8" />
                        </div>
                        <div>
                          <Label className="text-[10px]">UF Actual (L)</Label>
                          <Input type="number" step="0.1" value={editForm.ufActual ?? ""} onChange={(e) => setEditForm({ ...editForm, ufActual: parseFloat(e.target.value) || null })} className="text-sm h-8" />
                        </div>
                        <div>
                          <Label className="text-[10px]">Blood Flow (ml/min)</Label>
                          <Input type="number" value={editForm.bloodFlow ?? ""} onChange={(e) => setEditForm({ ...editForm, bloodFlow: parseInt(e.target.value) || null })} className="text-sm h-8" />
                        </div>
                        <div>
                          <Label className="text-[10px]">Dialysate Flow (ml/min)</Label>
                          <Input type="number" value={editForm.dialysateFlow ?? ""} onChange={(e) => setEditForm({ ...editForm, dialysateFlow: parseInt(e.target.value) || null })} className="text-sm h-8" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px]">Complications</Label>
                        <Textarea value={editForm.complications ?? ""} onChange={(e) => setEditForm({ ...editForm, complications: e.target.value })} className="text-sm" rows={1} placeholder="Any complications..." />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave}><Save className="h-3 w-3 mr-1" /> Save Vitals</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2">
                        <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="text-xs">
                          <p className="text-muted-foreground">Weight</p>
                          <p className="font-medium">
                            {session.preWeight ?? "—"} → {session.postWeight ?? "—"} kg
                            {weightChange && <span className="text-green-600 ml-1">(-{weightChange})</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="text-xs">
                          <p className="text-muted-foreground">BP</p>
                          <p className="font-medium">
                            {session.preBpSystolic ?? "—"}/{session.preBpDiastolic ?? "—"} → {session.postBpSystolic ?? "—"}/{session.postBpDiastolic ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="text-xs">
                          <p className="text-muted-foreground">Temp / Pulse</p>
                          <p className="font-medium">
                            {session.preTemperature ?? "—"}&deg;C / {session.prePulse ?? "—"} bpm
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="text-xs">
                          <p className="text-muted-foreground">UF / Flow</p>
                          <p className="font-medium">
                            {session.ufActual ?? "—"}/{session.ufGoal ?? "—"}L · {session.bloodFlow ?? "—"} ml/min
                          </p>
                        </div>
                      </div>
                      {session.complications && (
                        <div className="col-span-full">
                          <Badge variant="destructive" className="text-xs">{session.complications}</Badge>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
