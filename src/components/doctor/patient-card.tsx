"use client";

import { useState } from "react";
import { User, Phone, Calendar, FileText, Pill, ClipboardList, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { patients, prescriptions, appointments } from "@/lib/demo-data";

type TabKey = "overview" | "history" | "prescriptions" | "notes";

/**
 * PatientCard
 *
 * Full patient view for the doctor: history, notes, prescriptions, documents.
 */
export function PatientCard({ patientId }: { patientId?: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const patient = patients.find((p) => p.id === patientId) ?? patients[0];
  const patientRx = prescriptions.filter((rx) => rx.patientId === patient.id);
  const patientAppts = appointments.filter((a) => a.patientId === patient.id);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "history", label: "Visit History" },
    { key: "prescriptions", label: "Prescriptions" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="space-y-4">
      {/* Patient Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{patient.name}</h3>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {patient.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Born: {patient.dateOfBirth}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge>{patient.gender}</Badge>
                {patient.allergies && patient.allergies.length > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Allergies: {patient.allergies.join(", ")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
            className="rounded-b-none"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Total Visits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{patientAppts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Pill className="h-4 w-4" />
                Prescriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{patientRx.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">3</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "history" && (
        <Card>
          <CardContent className="pt-6">
            {patientAppts.length > 0 ? (
              <div className="space-y-3">
                {patientAppts.map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{appt.serviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {appt.date} at {appt.time} - Dr. {appt.doctorName}
                      </p>
                    </div>
                    <Badge variant={appt.status === "completed" ? "default" : "secondary"}>
                      {appt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No visit history found.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "prescriptions" && (
        <Card>
          <CardContent className="pt-6">
            {patientRx.length > 0 ? (
              <div className="space-y-4">
                {patientRx.map((rx) => (
                  <div key={rx.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">Dr. {rx.doctorName}</p>
                      <span className="text-xs text-muted-foreground">{rx.date}</span>
                    </div>
                    <div className="space-y-1">
                      {rx.medications.map((med, idx) => (
                        <div key={idx} className="text-sm flex items-center gap-2">
                          <Pill className="h-3 w-3 text-muted-foreground" />
                          <span>{med.name}</span>
                          <span className="text-muted-foreground">- {med.dosage}, {med.duration}</span>
                        </div>
                      ))}
                    </div>
                    {rx.notes && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" />
                        {rx.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No prescriptions found.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "notes" && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">Initial Consultation</p>
                  <span className="text-xs text-muted-foreground">2024-01-15</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Patient presents with recurring headaches. Blood pressure normal. Recommended lifestyle changes and follow-up in 2 weeks.
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">Follow-up Visit</p>
                  <span className="text-xs text-muted-foreground">2024-02-01</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Symptoms improved. Continue current treatment plan. Next follow-up in 1 month.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
