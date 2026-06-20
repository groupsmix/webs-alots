"use client";

import { useState, useEffect } from "react";
import { SessionScheduler } from "@/components/dialysis/session-scheduler";
import { VitalsTracker } from "@/components/dialysis/vitals-tracker";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchDialysisSessions,
  fetchPatients,
  createDialysisSession,
  updateDialysisSessionStatus,
  updateDialysisSessionVitals,
  type DialysisSessionView,
  type PatientView,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { DialysisSessionStatus, DialysisRecurrencePattern } from "@/lib/types/database";

export default function DoctorDialysisSessionsPage() {
  const { addToast } = useToast();
  const [sessions, setSessions] = useState<DialysisSessionView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }
      setClinicId(user.clinic_id);
      const [sess, pats] = await Promise.all([
        fetchDialysisSessions(user.clinic_id),
        fetchPatients(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setSessions(sess);
      setPatients(pats);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function handleAddSession(data: {
    patientName: string;
    sessionDate: string;
    startTime: string;
    durationMinutes: number;
    isRecurring: boolean;
    recurrencePattern: DialysisRecurrencePattern | null;
  }) {
    if (!clinicId) return;
    const patient = patients.find(
      (p) => p.name.toLowerCase() === data.patientName.toLowerCase().trim(),
    );
    if (!patient) {
      addToast("Patient not found. Enter the exact patient name.", "error");
      return;
    }
    try {
      const { id } = await createDialysisSession(clinicId, patient.id, {
        sessionDate: data.sessionDate,
        startTime: data.startTime,
        durationMinutes: data.durationMinutes,
        isRecurring: data.isRecurring,
        recurrencePattern: data.recurrencePattern,
      });
      setSessions((prev) => [
        {
          id,
          patientId: patient.id,
          patientName: patient.name,
          doctorName: null,
          machineName: null,
          sessionDate: data.sessionDate,
          startTime: data.startTime,
          endTime: null,
          durationMinutes: data.durationMinutes,
          status: "scheduled" as DialysisSessionStatus,
          isRecurring: data.isRecurring,
          recurrencePattern: data.recurrencePattern,
          accessType: null,
          preWeight: null,
          postWeight: null,
          preBpSystolic: null,
          preBpDiastolic: null,
          postBpSystolic: null,
          postBpDiastolic: null,
          prePulse: null,
          postPulse: null,
          preTemperature: null,
          postTemperature: null,
          ufGoal: null,
          ufActual: null,
          dialysateFlow: null,
          bloodFlow: null,
          complications: null,
          notes: null,
        },
        ...prev,
      ]);
      addToast("Session scheduled", "success");
    } catch (err) {
      logger.warn("Failed to schedule dialysis session", {
        context: "doctor/dialysis-sessions",
        error: err,
      });
      addToast("Failed to schedule session. Please try again.", "error");
    }
  }

  async function handleUpdateStatus(sessionId: string, status: DialysisSessionStatus) {
    const previous = sessions;
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status } : s)),
    );
    try {
      await updateDialysisSessionStatus(sessionId, status);
      addToast(`Session ${status.replace("_", " ")}`, "success");
    } catch (err) {
      logger.warn("Failed to update session status", {
        context: "doctor/dialysis-sessions",
        error: err,
      });
      setSessions(previous);
      addToast("Failed to update session. Please try again.", "error");
    }
  }

  async function handleSaveVitals(
    sessionId: string,
    vitals: Partial<{
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
    }>,
  ) {
    const previous = sessions;
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, ...vitals } : s)),
    );
    try {
      await updateDialysisSessionVitals(sessionId, vitals);
      addToast("Vitals saved", "success");
    } catch (err) {
      logger.warn("Failed to save vitals", { context: "doctor/dialysis-sessions", error: err });
      setSessions(previous);
      addToast("Failed to save vitals. Please try again.", "error");
    }
  }

  if (loading) return <PageLoader message="Loading dialysis sessions..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load dialysis sessions.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Dialysis Sessions" }]}
      />
      <h1 className="text-2xl font-bold">Dialysis Sessions</h1>
      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="mt-4">
          <SessionScheduler
            sessions={sessions}
            editable
            onAdd={handleAddSession}
            onUpdateStatus={handleUpdateStatus}
          />
        </TabsContent>
        <TabsContent value="vitals" className="mt-4">
          <VitalsTracker
            sessions={sessions}
            editable
            onSaveVitals={handleSaveVitals}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
