"use client";

import { Activity, Pill, FileText, Stethoscope, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { patients, prescriptions, appointments } from "@/lib/demo-data";

const patientId = "p1";
const patient = patients.find((p) => p.id === patientId) ?? patients[0];
const patientRx = prescriptions.filter((rx) => rx.patientId === patient.id);
const completedVisits = appointments
  .filter((a) => a.patientId === patient.id && a.status === "completed");

const mockDiagnoses = [
  { date: "2026-03-19", doctor: "Dr. Ahmed Benali", diagnosis: "Upper respiratory infection", notes: "Prescribed antibiotics. Follow-up in 7 days.", vitals: "BP: 120/80, Temp: 37.8°C", severity: "moderate" },
  { date: "2026-02-15", doctor: "Dr. Ahmed Benali", diagnosis: "Annual check-up", notes: "All vitals normal. Blood work ordered.", vitals: "BP: 118/76, Temp: 36.6°C", severity: "routine" },
  { date: "2025-12-10", doctor: "Dr. Youssef El Amrani", diagnosis: "Mild hypertension", notes: "Started on lifestyle modifications. Re-check in 3 months.", vitals: "BP: 140/90, Temp: 36.5°C", severity: "moderate" },
  { date: "2025-09-05", doctor: "Dr. Ahmed Benali", diagnosis: "Seasonal allergies", notes: "Antihistamine prescribed. Avoid outdoor exposure during peak pollen.", vitals: "BP: 122/78, Temp: 36.7°C", severity: "mild" },
];

const vitals = [
  { label: "Blood Pressure", value: "120/80 mmHg", icon: Activity, trend: "stable", color: "text-blue-600" },
  { label: "Heart Rate", value: "72 bpm", icon: TrendingUp, trend: "normal", color: "text-red-600" },
  { label: "Temperature", value: "36.8°C", icon: Activity, trend: "normal", color: "text-orange-600" },
  { label: "Weight", value: "75 kg", icon: TrendingUp, trend: "stable", color: "text-green-600" },
];

const severityColors: Record<string, string> = {
  mild: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  moderate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  severe: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  routine: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

export default function MedicalHistoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Medical History</h1>

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
              <p className="text-sm font-medium">{patient.dateOfBirth}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gender</p>
              <p className="text-sm font-medium">{patient.gender === "M" ? "Male" : "Female"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Blood Type</p>
              <p className="text-sm font-medium">A+</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Insurance</p>
              <p className="text-sm font-medium">{patient.insurance ?? "None"}</p>
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
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {vitals.map((vital) => (
              <div key={vital.label} className="text-center p-3 border rounded-lg">
                <vital.icon className={`h-4 w-4 mx-auto mb-1 ${vital.color}`} />
                <p className="text-xs text-muted-foreground">{vital.label}</p>
                <p className="text-sm font-bold">{vital.value}</p>
                <Badge variant="outline" className="text-[10px] mt-1">{vital.trend}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Past Visits & Diagnoses
            <Badge variant="secondary" className="ml-auto">{completedVisits.length + mockDiagnoses.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockDiagnoses.map((visit, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{visit.diagnosis}</p>
                    <p className="text-xs text-muted-foreground">{visit.doctor}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[visit.severity] ?? ""}`}>
                      {visit.severity}
                    </span>
                    <Badge variant="outline" className="text-xs">{visit.date}</Badge>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Vitals:</span> {visit.vitals}</p>
                  <p><span className="text-muted-foreground">Notes:</span> {visit.notes}</p>
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
                    <Badge variant="outline" className="text-xs">{rx.date}</Badge>
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
