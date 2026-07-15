"use client";

import { Activity, Pill, FileText, Stethoscope, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
  getCurrentUser,
  fetchPatientAppointments,
  fetchPrescriptions,
  fetchConsultationNotes,
  type AppointmentView,
  type PrescriptionView,
  type ConsultationNoteView,
} from "@/lib/data/client";

const MEDICAL_HISTORY_LIMITED_MESSAGE =
  "Demographic summary fields and latest vitals are temporarily unavailable in this deployment. Visit notes and prescription history remain available below.";

const severityColors: Record<string, string> = {
  mild: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  moderate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  severe: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  routine: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

export default function MedicalHistoryPage() {
  const [completedVisits, setCompletedVisits] = useState<AppointmentView[]>([]);
  const [patientRx, setPatientRx] = useState<PrescriptionView[]>([]);
  const [consultNotes, setConsultNotes] = useState<ConsultationNoteView[]>([]);
  const [patient, setPatient] = useState<{
    dateOfBirth: string;
    gender: string;
    insurance: string;
    allergies: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      const [appts, rxs, notes] = await Promise.all([
        fetchPatientAppointments(user.clinic_id, user.id),
        fetchPrescriptions(user.clinic_id),
        fetchConsultationNotes(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setCompletedVisits(appts.filter((a) => a.status === "completed"));
      setPatientRx(rxs.filter((rx) => rx.patientId === user.id));
      setConsultNotes(notes);
      setPatient({ dateOfBirth: "", gender: "", insurance: "", allergies: [] });
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => {
      controller.abort();
    };
  }, []);

  if (loading || !patient) {
    return <PageLoader message="Loading medical history..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">
          Failed to load data. Please try refreshing the page.
        </p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const diagnoses = consultNotes.map((n) => ({
    date: n.date,
    doctor: n.doctorName ?? "",
    diagnosis: n.diagnosis,
    notes: n.notes ?? "",
    vitals: "",
    severity: "routine" as string,
  }));

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Medical History" }]}
      />
      <h1 className="text-2xl font-bold mb-4">Medical History</h1>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        {MEDICAL_HISTORY_LIMITED_MESSAGE}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Medical Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Date of Birth</p>
              <p className="text-sm font-medium">{patient.dateOfBirth || "Unavailable"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gender</p>
              <p className="text-sm font-medium">
                {patient.gender ? (patient.gender === "M" ? "Male" : "Female") : "Unavailable"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Blood Type</p>
              <p className="text-sm font-medium">Unavailable</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Insurance</p>
              <p className="text-sm font-medium">{patient.insurance || "Unavailable"}</p>
            </div>
          </div>
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Known Allergies</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {patient.allergies.map((allergy) => (
                    <Badge key={allergy} variant="destructive" className="text-xs">
                      {allergy}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Latest Vitals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Latest vitals are not available in this deployment.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Past Visits & Diagnoses
            <Badge variant="secondary" className="ms-auto">
              {completedVisits.length + diagnoses.length} records
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {diagnoses.map((visit) => (
              <div
                key={`${visit.date}-${visit.diagnosis}-${visit.doctor}`}
                className="border rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{visit.diagnosis}</p>
                    <p className="text-xs text-muted-foreground">{visit.doctor}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[visit.severity] ?? ""}`}
                    >
                      {visit.severity}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {visit.date}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  {visit.vitals && (
                    <p>
                      <span className="text-muted-foreground">Vitals:</span> {visit.vitals}
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">Notes:</span> {visit.notes}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="h-4 w-4" />
            Prescription History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patientRx.length > 0 ? (
            <div className="space-y-3">
              {patientRx.map((rx) => (
                <div key={rx.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{rx.doctorName}</p>
                    <Badge variant="outline" className="text-xs">
                      {rx.date}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {rx.medications.map((med, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">
                        {med.name} — {med.dosage} ({med.duration})
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No prescriptions on record.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
