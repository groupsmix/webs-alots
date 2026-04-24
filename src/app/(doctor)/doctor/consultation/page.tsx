"use client";

import { FileEdit, CheckCircle, XCircle, Save, Eye, EyeOff, Plus, CloudOff, Cloud, Loader2, Printer } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/components/tenant-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { Textarea } from "@/components/ui/textarea";
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
import { useOfflineDrafts } from "@/lib/hooks/use-offline-drafts";

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
  const content = n.content ?? {};
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

function printConsultationNote(apt: AppointmentView, note: ConsultationNote, clinicName: string): void {

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Consultation – ${apt.patientName}</title>
<style>
  body{font-family:Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#000;margin:0;padding:20mm}
  .letterhead{text-align:center;margin-bottom:12pt}
  .letterhead h2{font-size:14pt;margin:0 0 2pt;color:#333}
  .letterhead p{font-size:9pt;color:#555;margin:0}
  .header{text-align:center;border-bottom:2px solid #333;padding-bottom:12pt;margin-bottom:18pt}
  .header h1{font-size:16pt;margin:0 0 4pt}
  .header p{font-size:9pt;color:#555;margin:0}
  .field{margin-bottom:8pt}
  .field-label{font-weight:600}
  .signature{margin-top:48pt;text-align:right;border-top:1px solid #999;padding-top:8pt;width:40%;margin-left:auto}
  @page{size:A4;margin:20mm}
</style></head><body>
${clinicName ? `<div class="letterhead"><h2>${clinicName}</h2></div>` : ""}
<div class="header"><h1>NOTES DE CONSULTATION</h1><p>${apt.serviceName} — ${apt.date}</p></div>
<div class="field"><span class="field-label">Patient :</span> ${apt.patientName}</div>
<div class="field"><span class="field-label">Date :</span> ${apt.date} à ${apt.time}</div>
<div class="field"><span class="field-label">Motif de consultation :</span> ${note.chiefComplaint}</div>
<div class="field"><span class="field-label">Examen :</span> ${note.examination}</div>
<div class="field"><span class="field-label">Diagnostic :</span> ${note.diagnosis}</div>
<div class="field"><span class="field-label">Plan :</span> ${note.plan}</div>
<div class="signature">Signature du médecin</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.addEventListener("load", () => { win.print(); });
}

export default function ConsultationNotesPage() {
  const tenant = useTenant();
  const [notes, setNotes] = useState<ConsultationNote[]>([]);
  const [apptList, setApptList] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [showPrivate, setShowPrivate] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    chiefComplaint: "",
    examination: "",
    diagnosis: "",
    plan: "",
    privateNotes: "",
  });
  const [savingNote, setSavingNote] = useState(false);

  // Auto-save drafts for the currently editing note
  const draftKey = editingApptId ? `consultation-note-${editingApptId}` : "consultation-note-none";
  const {
    draft,
    saveDraft,
    clearDraft,
    isSynced,
    hasDraft,
  } = useOfflineDrafts<typeof formData>(draftKey, { autoSaveMs: 5000 });

  // Track whether we've shown the restore prompt for this editing session
  const [draftRestoreOffered, setDraftRestoreOffered] = useState(false);

  const updateFormField = useCallback(
    (field: string, value: string) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };
        saveDraft(updated);
        return updated;
      });
    },
    [saveDraft],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const [appts, dbNotes] = await Promise.all([
      fetchDoctorAppointments(user.clinic_id, user.id),
      fetchConsultationNotes(user.clinic_id, user.id),
    ]);
      if (controller.signal.aborted) return;
    setApptList(appts);
    setNotes(dbNotes.map(mapDbNoteToLocal));
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

  // Check for unsaved draft when editor opens
  const shouldOfferRestore = editingApptId && hasDraft && draft && !isSynced && !draftRestoreOffered;
  if (shouldOfferRestore) {
    setDraftRestoreOffered(true);
  }

  if (loading) {
    return <PageLoader message="Loading consultation notes..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
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
    setDraftRestoreOffered(false);
    setEditingApptId(appointmentId);
  };

  const handleSaveNote = async () => {
    if (!editingApptId) return;
    const appt = apptList.find((a) => a.id === editingApptId);
    if (!appt) return;

    setSavingNote(true);
    const existing = getNoteForAppointment(editingApptId);
    const now = new Date().toISOString();
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setSavingNote(false); return; }

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
        clearDraft();
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
        clearDraft();
      }
    }
    setSavingNote(false);
    setEditingApptId(null);
  };

  const handleMarkDone = async (appointmentId: string) => {
    const apt = apptList.find((a) => a.id === appointmentId);
    const previousStatus = apt?.status ?? "in-progress";
    // Optimistic update
    setApptList((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: "completed" } : a))
    );
    const result = await updateAppointmentStatus(appointmentId, "completed");
    if (!result.success) {
      // Roll back on failure
      setApptList((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: previousStatus } : a))
      );
    }
  };

  const handleNoShow = async (appointmentId: string) => {
    const apt = apptList.find((a) => a.id === appointmentId);
    const previousStatus = apt?.status ?? "scheduled";
    // Optimistic update
    setApptList((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: "no-show" } : a))
    );
    const result = await updateAppointmentStatus(appointmentId, "no-show");
    if (!result.success) {
      // Roll back on failure
      setApptList((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: previousStatus } : a))
      );
    }
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
                  <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Consultation" }]} />
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
                  {note && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => printConsultationNote(apt, note, tenant?.clinicName ?? "")}
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" />
                      Print
                    </Button>
                  )}
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
                onChange={(e) => updateFormField("chiefComplaint", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Examination</Label>
              <Textarea
                placeholder="Physical examination findings..."
                value={formData.examination}
                onChange={(e) => updateFormField("examination", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Input
                placeholder="Diagnosis..."
                value={formData.diagnosis}
                onChange={(e) => updateFormField("diagnosis", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Textarea
                placeholder="Treatment plan and next steps..."
                value={formData.plan}
                onChange={(e) => updateFormField("plan", e.target.value)}
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
                onChange={(e) => updateFormField("privateNotes", e.target.value)}
                className="border-yellow-200 dark:border-yellow-800"
              />
            </div>
            {/* Draft restore banner */}
            {draftRestoreOffered && hasDraft && draft && !isSynced && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3">
                <CloudOff className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200 flex-1">
                  An unsaved draft was found. Restore it?
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setFormData(draft);
                    setDraftRestoreOffered(false);
                  }}
                >
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    clearDraft();
                    setDraftRestoreOffered(false);
                  }}
                >
                  Discard
                </Button>
              </div>
            )}

            {/* Draft status indicator + actions */}
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {savingNote ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
                ) : isSynced ? (
                  <><Cloud className="h-3 w-3 text-green-500" /> Draft saved</>
                ) : (
                  <><CloudOff className="h-3 w-3 text-amber-500" /> Unsaved changes</>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingApptId(null)}>Cancel</Button>
                <Button onClick={handleSaveNote} disabled={savingNote}>
                  <Save className="h-4 w-4 mr-1" />
                  Save Notes
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
