"use client";

import { useState, useEffect } from "react";
import { Activity, Pill, FileText, Stethoscope, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentUser,
  fetchPatientAppointments,
  fetchPatientPrescriptions,
  fetchPatients,
  type PatientView,
  type AppointmentView,
  type PrescriptionView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * MedicalRecord
 *
 * Displays a patient's medical history: past visits, diagnoses, prescriptions.
 */
export function MedicalRecord({ patientId }: { patientId?: string }) {
  const [patient, setPatient] = useState<PatientView | null>(null);
  const [patientRx, setPatientRx] = useState<PrescriptionView[]>([]);
  const [patientAppts, setPatientAppts] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const pid = patientId ?? user.id;

    const [patients, appointments, prescriptions] = await Promise.all([
      fetchPatients(user.clinic_id),
      fetchPatientAppointments(user.clinic_id, pid),
      fetchPatientPrescriptions(user.clinic_id, pid),
    ]);
      if (controller.signal.aborted) return;

    const found = patients.find((p) => p.id === pid) ?? null;
    setPatient(found);
    setPatientRx(prescriptions);
    setPatientAppts(
      appointments
        .filter((a) => a.status === "completed")
        .slice(0, 5),
    );
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, [patientId]);

  if (loading) {
    return <PageLoader message="Loading medical record..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Patient not found.</p>
      </div>
    );
  }

  const vitals = [
    { label: "Blood Pressure", value: "120/80 mmHg", icon: Activity, trend: "stable" },
    { label: "Heart Rate", value: "72 bpm", icon: TrendingUp, trend: "normal" },
    { label: "Temperature", value: "36.8 C", icon: Activity, trend: "normal" },
    { label: "Weight", value: "75 kg", icon: TrendingUp, trend: "stable" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Medical Summary - {patient.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Date of Birth</p>
              <p className="text-sm font-medium">{patient.dateOfBirth}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gender</p>
              <p className="text-sm font-medium">{patient.gender}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Blood Type</p>
              <p className="text-sm font-medium">A+</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Insurance</p>
              <p className="text-sm font-medium">{patient.insurance ?? "N/A"}</p>
            </div>
          </div>
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="mt-3 p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Known Allergies</p>
                <div className="flex gap-1 mt-1">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Latest Vitals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {vitals.map((vital) => (
              <div key={vital.label} className="text-center p-3 border rounded-lg">
                <vital.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">{vital.label}</p>
                <p className="text-sm font-bold">{vital.value}</p>
                <Badge variant="outline" className="text-[10px] mt-1">{vital.trend}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Visit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patientAppts.length > 0 ? (
            <div className="space-y-3">
              {patientAppts.map((appt) => (
                <div key={appt.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{appt.serviceName}</p>
                    <span className="text-xs text-muted-foreground">{appt.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Dr. {appt.doctorName}</p>
                  <Badge variant="secondary" className="text-xs mt-2">Completed</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No visit history available.</p>
          )}
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
                    <p className="text-sm font-medium">Dr. {rx.doctorName}</p>
                    <span className="text-xs text-muted-foreground">{rx.date}</span>
                  </div>
                  <div className="space-y-1">
                    {rx.medications.map((med, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">
                        {med.name} - {med.dosage} ({med.duration})
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
