"use client";

import { useState, useEffect, useCallback } from "react";
import { FileEdit, CheckCircle, XCircle, Save, Eye, EyeOff, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getCurrentUser,
  fetchDoctorAppointments,
  fetchConsultationNotes,
  updateAppointmentStatus,
  createConsultationNote,
  updateConsultationNote,
  type AppointmentView,
  type ConsultationNoteView,
} from "@/lib/data/client";

interface ConsultationNote {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  date: string;
  chiefComplaint: string;
  examination: string;
  diagnosis: string;
  plan: string;
  privateNotes?: string;
  createdAt: string;
  updatedAt: string;
}

function mapDbNoteToLocal(n: ConsultationNoteView): ConsultationNote {
  const content = (n as unknown as { content?: Record<string, string> }).content ?? {};
  return {
    id: n.id,
    appointmentId: n.appointmentId,
    patientId: n.patientId,
    doctorId: "",
    date: n.date,
    chiefComplaint: content.chiefComplaint ?? "",
    examination: content.examination ?? "",
    diagnosis: n.diagnosis,
    plan: content.plan ?? "",
    privateNotes: content.privateNotes ?? "",
    createdAt: n.date,
    updatedAt: n.date,
  };
}

export default function ConsultationNotesPage() {
  const [notes, setNotes] = useState<ConsultationNote[]>([]);
  const [apptList, setApptList] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [showPrivate, setShowPrivate] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    chiefComplaint: "",
    examination: "",
    diagnosis: "",
    plan: "",
    privateNotes: "",
  });

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [appts, dbNotes] = await Promise.all([
      fetchDoctorAppointments(user.clinic_id, user.id),
      fetchConsultationNotes(user.clinic_id, user.id),
    ]);
    setApptList(appts);
    setNotes(dbNotes.map(mapDbNoteToLocal));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading consultation notes...</p>
      </div>
    );
  }

  const recentAppts = apptList
    .filter((a) => a.status === "completed" || a.status === "in-progress" || a.status === "confirmed")
    .slice(0, 10);

  const getNoteForAppointment = (appointmentId: string) => {
    return notes.find((n) => n.appointmentId === appointmentId);
  };

  const handleOpenEditor = (appointmentId: string) => {
    const existing = getNoteForAppointment(appointmentId);
    if (existing) {
      setFormData({
        chiefComplaint: existing.chiefComplaint,
        examination: existing.examination,
        diagnosis: existing.diagnosis,
        plan: existing.plan,
        privateNotes: existing.privateNotes || "",
      });
    } else {
      setFormData({ chiefComplaint: "", examination: "", diagnosis: "", plan: "", privateNotes: "" });
    }
    setEditingApptId(appointmentId);
  };

  const handleSaveNote = async () => {
    if (!editingApptId) return;
    const appt = apptList.find((a) => a.id === editingApptId);
    if (!appt) return;

    const existing = getNoteForAppointment(editingApptId);
    const now = new Date().toISOString();
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;

    const content = {
      chiefComplaint: formData.chiefComplaint,
      examination: formData.examination,
      plan: formData.plan,
      privateNotes: formData.privateNotes,
    };

    if (existing) {
      const ok = await updateConsultationNote(existing.id, {
        diagnosis: formData.diagnosis,
        notes: formData.chiefComplaint,
        content,
        is_private: !!formData.privateNotes,
      });
      if (ok) {
        setNotes((prev) =>
          prev.map((n) =>
            n.appointmentId === editingApptId
              ? { ...n, ...formData, updatedAt: now }
              : n
          )
        );
      }
    } else {
      const newId = await createConsultationNote({
        clinic_id: user.clinic_id,
        doctor_id: user.id,
        patient_id: appt.patientId,
        appointment_id: editingApptId,
        diagnosis: formData.diagnosis,
        notes: formData.chiefComplaint,
        content,
        is_private: !!formData.privateNotes,
      });
      if (newId) {
        const newNote: ConsultationNote = {
          id: newId,
          appointmentId: editingApptId,
          patientId: appt.patientId,
          doctorId: user.id,
          date: appt.date,
          ...formData,
          createdAt: now,
          updatedAt: now,
        };
        setNotes((prev) => [...prev, newNote]);
      }
    }
    setEditingApptId(null);
  };

  const handleMarkDone = async (appointmentId: string) => {
    await updateAppointmentStatus(appointmentId, "completed");
    setApptList((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: "completed" } : a))
    );
  };

  const handleNoShow = async (appointmentId: string) => {
    await updateAppointmentStatus(appointmentId, "no-show");
    setApptList((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: "no-show" } : a))
    );
  };

  const togglePrivate = (noteId: string) => {
    setShowPrivate((prev) => ({ ...prev, [noteId]: !prev[noteId] }));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Consultation Notes</h1>

      <div className="space-y-4">
        {recentAppts.map((apt) => {
          const note = getNoteForAppointment(apt.id);
          return (
            <Card key={apt.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="text-xs">
                        {apt.patientName.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{apt.patientName}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {apt.serviceName} &middot; {apt.date} at {apt.time}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      apt.status === "completed" ? "success" :
                      apt.status === "in-progress" ? "warning" : "default"
                    }
                  >
                    {apt.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {note ? (
                  <div className="space-y-2 mb-3">
                    <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                      <p><span className="font-medium">Complaint:</span> {note.chiefComplaint}</p>
                      <p><span className="font-medium">Examination:</span> {note.examination}</p>
                      <p><span className="font-medium">Diagnosis:</span> {note.diagnosis}</p>
                      <p><span className="font-medium">Plan:</span> {note.plan}</p>
                    </div>
                    {note.privateNotes && (
                      <div className="flex items-start gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePrivate(note.id)}
                          className="text-xs text-yellow-600"
                        >
                          {showPrivate[note.id] ? (
                            <><EyeOff className="h-3 w-3 mr-1" /> Hide Private Notes</>
                          ) : (
                            <><Eye className="h-3 w-3 mr-1" /> Show Private Notes</>
                          )}
                        </Button>
                        {showPrivate[note.id] && (
                          <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 rounded p-2 text-xs text-yellow-800 dark:text-yellow-200">
                            {note.privateNotes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic mb-3">No consultation notes yet.</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEditor(apt.id)}>
                    {note ? (
                      <><FileEdit className="h-3.5 w-3.5 mr-1" /> Edit Notes</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5 mr-1" /> Add Notes</>
                    )}
                  </Button>
                  {apt.status !== "completed" && apt.status !== "no-show" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600"
                        onClick={() => handleMarkDone(apt.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Done
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500"
                        onClick={() => handleNoShow(apt.id)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        No Show
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Note Editor Dialog */}
      <Dialog open={!!editingApptId} onOpenChange={(open) => { if (!open) setEditingApptId(null); }}>
        <DialogContent className="max-w-lg" onClose={() => setEditingApptId(null)}>
          <DialogHeader>
            <DialogTitle>
              {editingApptId && getNoteForAppointment(editingApptId) ? "Edit" : "Add"} Consultation Notes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Chief Complaint</Label>
              <Textarea
                placeholder="What is the patient's main concern?"
                value={formData.chiefComplaint}
                onChange={(e) => setFormData((p) => ({ ...p, chiefComplaint: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Examination</Label>
              <Textarea
                placeholder="Physical examination findings..."
                value={formData.examination}
                onChange={(e) => setFormData((p) => ({ ...p, examination: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Input
                placeholder="Diagnosis..."
                value={formData.diagnosis}
                onChange={(e) => setFormData((p) => ({ ...p, diagnosis: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Textarea
                placeholder="Treatment plan and next steps..."
                value={formData.plan}
                onChange={(e) => setFormData((p) => ({ ...p, plan: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5 text-yellow-600" />
                Private Notes (only visible to you)
              </Label>
              <Textarea
                placeholder="Private observations, reminders..."
                value={formData.privateNotes}
                onChange={(e) => setFormData((p) => ({ ...p, privateNotes: e.target.value }))}
                className="border-yellow-200 dark:border-yellow-800"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingApptId(null)}>Cancel</Button>
              <Button onClick={handleSaveNote}>
                <Save className="h-4 w-4 mr-1" />
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
