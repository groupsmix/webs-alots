"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, User, Phone, Calendar, FileText, Pill, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getCurrentUser,
  fetchPatients,
  fetchAppointments,
  fetchPrescriptions,
  fetchConsultationNotes,
  type PatientView,
  type AppointmentView,
  type PrescriptionView,
  type ConsultationNoteView,
} from "@/lib/data/client";

type Patient = PatientView;

export default function DoctorPatientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "prescriptions" | "notes">("overview");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionView[]>([]);
  const [consultationNotes, setConsultationNotes] = useState<ConsultationNoteView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [pts, appts, rxs, notes] = await Promise.all([
      fetchPatients(user.clinic_id),
      fetchAppointments(user.clinic_id),
      fetchPrescriptions(user.clinic_id),
      fetchConsultationNotes(user.clinic_id, user.id),
    ]);
    setPatients(pts);
    setAppointments(appts);
    setPrescriptions(rxs);
    setConsultationNotes(notes);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading patients...</p>
      </div>
    );
  }

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      p.id.includes(searchQuery)
  );

  const getPatientData = (patient: Patient) => {
    const patientAppts = appointments.filter((a) => a.patientId === patient.id);
    const patientRx = prescriptions.filter((rx) => rx.patientId === patient.id);
    const patientNotes = consultationNotes.filter((n) => n.patientId === patient.id);
    return { patientAppts, patientRx, patientNotes: patientNotes.map(n => ({ ...n, chiefComplaint: "", examination: "", plan: "", privateNotes: "" })) };
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Patients</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search patients by name, phone, or ID..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPatients.map((patient) => {
          const patientAppts = appointments.filter((a) => a.patientId === patient.id);
          const lastVisit = patientAppts.filter((a) => a.status === "completed").sort((a, b) => b.date.localeCompare(a.date))[0];
          return (
            <Card
              key={patient.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => { setSelectedPatient(patient); setActiveTab("overview"); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {patient.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">{patient.phone}</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Age</span>
                    <span className="font-medium text-foreground">{patient.age}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gender</span>
                    <span className="font-medium text-foreground capitalize">{patient.gender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Insurance</span>
                    <Badge variant={patient.insurance ? "success" : "secondary"} className="text-[10px]">
                      {patient.insurance || "None"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Visits</span>
                    <span className="font-medium text-foreground">{patientAppts.length}</span>
                  </div>
                  {lastVisit && (
                    <div className="flex justify-between">
                      <span>Last Visit</span>
                      <span className="font-medium text-foreground">{lastVisit.date}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredPatients.length === 0 && (
        <p className="text-center text-muted-foreground mt-8">No patients found matching your search.</p>
      )}

      {/* Patient Detail Modal */}
      <Dialog open={!!selectedPatient} onOpenChange={(open) => { if (!open) setSelectedPatient(null); }}>
        {selectedPatient && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto" onClose={() => setSelectedPatient(null)}>
            <DialogHeader>
              <DialogTitle>Patient Details</DialogTitle>
            </DialogHeader>

            {/* Patient Header */}
            <div className="flex items-start gap-4 mt-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{selectedPatient.name}</h3>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {selectedPatient.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Born: {selectedPatient.dateOfBirth}
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge>{selectedPatient.gender}</Badge>
                  <Badge variant="outline">Age: {selectedPatient.age}</Badge>
                  {selectedPatient.insurance && <Badge variant="secondary">{selectedPatient.insurance}</Badge>}
                  {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {selectedPatient.allergies.join(", ")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b mt-4">
              {(["overview", "history", "prescriptions", "notes"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                  className="rounded-b-none capitalize"
                >
                  {tab === "notes" ? "Consultation Notes" : tab}
                </Button>
              ))}
            </div>

            {/* Tab Content */}
            {(() => {
              const { patientAppts, patientRx, patientNotes } = getPatientData(selectedPatient);

              if (activeTab === "overview") {
                return (
                  <div className="grid gap-4 grid-cols-3 mt-4">
                    <div className="border rounded-lg p-3 text-center">
                      <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold">{patientAppts.length}</p>
                      <p className="text-xs text-muted-foreground">Total Visits</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <Pill className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold">{patientRx.length}</p>
                      <p className="text-xs text-muted-foreground">Prescriptions</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <FileText className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold">{patientNotes.length}</p>
                      <p className="text-xs text-muted-foreground">Notes</p>
                    </div>
                  </div>
                );
              }

              if (activeTab === "history") {
                return (
                  <div className="space-y-3 mt-4">
                    {patientAppts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No visit history.</p>
                    ) : (
                      patientAppts.map((appt) => (
                        <div key={appt.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                          <div>
                            <p className="font-medium text-sm">{appt.serviceName}</p>
                            <p className="text-xs text-muted-foreground">{appt.date} at {appt.time} - {appt.doctorName}</p>
                          </div>
                          <Badge variant={appt.status === "completed" ? "default" : "secondary"}>{appt.status}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                );
              }

              if (activeTab === "prescriptions") {
                return (
                  <div className="space-y-4 mt-4">
                    {patientRx.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No prescriptions found.</p>
                    ) : (
                      patientRx.map((rx) => (
                        <div key={rx.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm">{rx.doctorName}</p>
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
                        </div>
                      ))
                    )}
                  </div>
                );
              }

              if (activeTab === "notes") {
                return (
                  <div className="space-y-4 mt-4">
                    {patientNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No consultation notes found.</p>
                    ) : (
                      patientNotes.map((note) => (
                        <div key={note.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{note.diagnosis}</p>
                            <span className="text-xs text-muted-foreground">{note.date}</span>
                          </div>
                          <div className="text-sm space-y-1">
                            {note.notes && <p>{note.notes}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              }

              return null;
            })()}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
