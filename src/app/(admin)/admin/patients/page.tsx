"use client";

import { Search, User, Phone, Mail, Calendar, Shield, Pill, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataMask } from "@/components/ui/data-mask";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getCurrentUser,
  fetchPatients,
  fetchAppointments,
  fetchPrescriptions,
  type PatientView,
  type AppointmentView,
  type PrescriptionView,
} from "@/lib/data/client";
import { exportPatients } from "@/lib/export-data";

type Patient = PatientView;

export default function AdminPatientDatabasePage() {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<AppointmentView[]>([]);
  const [prescriptionsList, setPrescriptionsList] = useState<PrescriptionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const [p, a, rx] = await Promise.all([
      fetchPatients(user.clinic_id),
      fetchAppointments(user.clinic_id),
      fetchPrescriptions(user.clinic_id),
    ]);
      if (controller.signal.aborted) return;
    setPatientsList(p);
    setAppointmentsList(a);
    setPrescriptionsList(rx);
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

  const patients = patientsList;
  const appointments = appointmentsList;
  const prescriptions = prescriptionsList;

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <PageLoader message="Loading patients..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const getPatientAppts = (patientId: string) =>
    appointments.filter((a) => a.patientId === patientId);

  const getPatientPrescriptions = (patientId: string) =>
    prescriptions.filter((rx) => rx.patientId === patientId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Patient Database</h1>
          <Badge variant="outline">{patients.length} patients</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportPatients(filtered)}>
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((patient) => {
          const patientAppts = getPatientAppts(patient.id);
          const lastVisit = patientAppts.find((a) => a.status === "completed");
          return (
            <Card key={patient.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Patients" }]} />
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{patient.name}</p>
                    <div className="space-y-1 mt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <DataMask value={patient.phone} type="phone" />
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <DataMask value={patient.email} type="email" />
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Age: {patient.age} | {patient.gender === "M" ? "Male" : "Female"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {patient.insurance && (
                        <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                          <Shield className="h-2.5 w-2.5" />
                          {patient.insurance}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {patientAppts.length} visits
                      </Badge>
                    </div>
                    {lastVisit && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Last visit: {lastVisit.date}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setSelectedPatient(patient)}>
                    View Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No patients found matching &quot;{search}&quot;</p>
        </div>
      )}

      {/* Patient Profile Dialog */}
      <Dialog open={selectedPatient !== null} onOpenChange={() => setSelectedPatient(null)}>
        {selectedPatient && (
          <DialogContent onClose={() => setSelectedPatient(null)} className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Patient Profile</DialogTitle>
              <DialogDescription>{selectedPatient.name}</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{selectedPatient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPatient.gender === "M" ? "Male" : "Female"}, {selectedPatient.age} years old
                  </p>
                  <p className="text-xs text-muted-foreground">DOB: {selectedPatient.dateOfBirth}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <DataMask value={selectedPatient.phone} type="phone" className="font-medium" />
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <DataMask value={selectedPatient.email} type="email" className="font-medium text-xs" />
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Insurance</p>
                  <p className="font-medium">{selectedPatient.insurance || "None"}</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Registered</p>
                  <p className="font-medium">{selectedPatient.registeredAt}</p>
                </div>
              </div>

              {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium mb-1">Allergies</p>
                  <div className="flex gap-1 flex-wrap">
                    {selectedPatient.allergies.map((a) => (
                      <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <Tabs defaultValue="appointments">
                <TabsList className="w-full">
                  <TabsTrigger value="appointments" className="flex-1">Appointments</TabsTrigger>
                  <TabsTrigger value="prescriptions" className="flex-1">Prescriptions</TabsTrigger>
                </TabsList>

                <TabsContent value="appointments">
                  <div className="space-y-2 mt-2">
                    {getPatientAppts(selectedPatient.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No appointments</p>
                    )}
                    {getPatientAppts(selectedPatient.id).map((appt) => (
                      <div key={appt.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                        <div>
                          <p className="font-medium">{appt.serviceName}</p>
                          <p className="text-xs text-muted-foreground">{appt.doctorName} — {appt.date} at {appt.time}</p>
                        </div>
                        <Badge
                          variant={
                            appt.status === "completed" ? "default" :
                            appt.status === "cancelled" ? "destructive" :
                            appt.status === "no-show" ? "destructive" : "secondary"
                          }
                          className="text-xs"
                        >
                          {appt.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="prescriptions">
                  <div className="space-y-2 mt-2">
                    {getPatientPrescriptions(selectedPatient.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No prescriptions</p>
                    )}
                    {getPatientPrescriptions(selectedPatient.id).map((rx) => (
                      <div key={rx.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium flex items-center gap-1">
                            <Pill className="h-3.5 w-3.5" />
                            {rx.doctorName}
                          </p>
                          <span className="text-xs text-muted-foreground">{rx.date}</span>
                        </div>
                        <div className="space-y-1">
                          {rx.medications.map((med, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{med.name}</span> — {med.dosage} for {med.duration}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
