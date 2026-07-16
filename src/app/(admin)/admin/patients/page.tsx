"use client";

import {
  Search,
  User,
  Phone,
  Mail,
  Calendar,
  Shield,
  Pill,
  Download,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  Loader2,
  UserPlus,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { updateClinicUser, setClinicUserActive, deleteClinicUser } from "@/lib/admin-actions";
import {
  getCurrentUser,
  fetchPatients,
  fetchAppointments,
  fetchPatientPrescriptions,
  type PatientView,
  type AppointmentView,
  type PrescriptionView,
} from "@/lib/data/client";
import { exportPatients } from "@/lib/export-data";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";

type Patient = PatientView;

export default function AdminPatientDatabasePage() {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<AppointmentView[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  // B6: the selected patient's prescriptions are loaded on demand instead of
  // pulling every prescription in the clinic up front.
  const [selectedRx, setSelectedRx] = useState<PrescriptionView[]>([]);
  const [rxLoading, setRxLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { addToast } = useToast();
  const [locale] = useLocale();
  const [editing, setEditing] = useState<Patient | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formInsurance, setFormInsurance] = useState("");

  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addDob, setAddDob] = useState("");
  const [addError, setAddError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      setClinicId(user.clinic_id);
      const [p, a] = await Promise.all([
        fetchPatients(user.clinic_id),
        fetchAppointments(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setPatientsList(p);
      setAppointmentsList(a);
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

  // B6: load the selected patient's prescriptions on demand.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (!selectedPatient || !clinicId) {
      timeout = setTimeout(() => setSelectedRx([]), 0);
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    } else {
      const controller = new AbortController();
      const patientId = selectedPatient.id;
      timeout = setTimeout(() => {
        setRxLoading(true);
        setSelectedRx([]);
        fetchPatientPrescriptions(clinicId, patientId)
          .then((rx) => {
            if (!controller.signal.aborted) setSelectedRx(rx);
          })
          .catch(() => {
            if (!controller.signal.aborted) setSelectedRx([]);
          })
          .finally(() => {
            if (!controller.signal.aborted) setRxLoading(false);
          });
      }, 0);
      return () => {
        if (timeout) clearTimeout(timeout);
        controller.abort();
      };
    }
  }, [selectedPatient, clinicId]);

  const patients = patientsList;
  const appointments = appointmentsList;
  const prescriptions = Array.isArray(selectedRx) ? selectedRx : [];

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      p.email.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return <PageLoader message="Loading patients..." />;
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

  const getPatientAppts = (patientId: string) =>
    appointments.filter((a) => a.patientId === patientId);

  const openEditDialog = (patient: Patient) => {
    setEditing(patient);
    setFormName(patient.name);
    setFormPhone(patient.phone);
    setFormEmail(patient.email);
    setFormInsurance(patient.insurance ?? "");
    setSelectedPatient(null);
  };

  const handleSaveEdit = async () => {
    if (!editing || !formName.trim()) return;
    setSaving(true);
    try {
      await updateClinicUser(editing.id, {
        name: formName,
        phone: formPhone,
        email: formEmail,
        metadata: { insurance: formInsurance || undefined },
      });
      setPatientsList((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? {
                ...p,
                name: formName,
                phone: formPhone,
                email: formEmail,
                insurance: formInsurance || undefined,
              }
            : p,
        ),
      );
      addToast("Patient updated", "success");
      setEditing(null);
    } catch (err) {
      logger.warn("Failed to update patient", { context: "admin/patients", error: err });
      addToast("Failed to update patient. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetAddForm = () => {
    setAddName("");
    setAddPhone("");
    setAddEmail("");
    setAddDob("");
    setAddError("");
  };

  const handleCreate = async () => {
    if (!addName.trim() || !addPhone.trim()) return;
    setCreating(true);
    setAddError("");
    try {
      const res = await fetch("/api/receptionist/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          phone: addPhone.trim(),
          email: addEmail.trim() || undefined,
          dateOfBirth: addDob || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { patient?: { id: string; name: string; phone: string }; existing?: boolean };
        error?: string;
      } | null;

      if (!res.ok || !json?.data?.patient) {
        setAddError(json?.error ?? "Failed to add patient. Please try again.");
        return;
      }

      const created = json.data.patient;
      if (json.data.existing) {
        addToast("A patient with this phone already exists", "info");
      } else {
        setPatientsList((prev) => {
          if (prev.some((p) => p.id === created.id)) return prev;
          const newPatient: Patient = {
            id: created.id,
            name: created.name,
            phone: created.phone,
            email: addEmail.trim(),
            age: 0,
            gender: "M",
            dateOfBirth: addDob,
            registeredAt: new Date().toISOString().slice(0, 10),
            active: true,
          };
          return [newPatient, ...prev];
        });
        addToast("Patient added", "success");
      }
      setAdding(false);
      resetAddForm();
    } catch (err) {
      logger.warn("Failed to add patient", { context: "admin/patients", error: err });
      setAddError("An error occurred. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (patient: Patient) => {
    const next = !patient.active;
    setPatientsList((prev) => prev.map((p) => (p.id === patient.id ? { ...p, active: next } : p)));
    setSelectedPatient(null);
    try {
      await setClinicUserActive(patient.id, next);
      addToast(next ? "Patient reactivated" : "Patient deactivated", "success");
    } catch (err) {
      logger.warn("Failed to toggle patient", { context: "admin/patients", error: err });
      setPatientsList((prev) =>
        prev.map((p) => (p.id === patient.id ? { ...p, active: !next } : p)),
      );
      addToast("Failed to update status. Please try again.", "error");
    }
  };

  const handleDelete = async (patient: Patient) => {
    const previous = patientsList;
    setPatientsList((prev) => prev.filter((p) => p.id !== patient.id));
    setDeleteConfirm(null);
    try {
      await deleteClinicUser(patient.id);
      addToast("Patient removed", "success");
    } catch (err) {
      logger.warn("Failed to delete patient", { context: "admin/patients", error: err });
      setPatientsList(previous);
      addToast("Failed to remove patient. Please try again.", "error");
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Patients" }]} />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Patient Database</h1>
          <Badge variant="outline">{patients.length} patients</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportPatients(filtered)}>
            <Download className="h-4 w-4 me-1" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetAddForm();
              setAdding(true);
            }}
          >
            <UserPlus className="h-4 w-4 me-1" />
            {t(locale, "admin.patients.add")}
          </Button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-10"
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
                      {!patient.active && (
                        <Badge variant="destructive" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    View Profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => openEditDialog(patient)}
                    aria-label="Edit patient"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => toggleActive(patient)}
                    aria-label={patient.active ? "Deactivate patient" : "Reactivate patient"}
                  >
                    {patient.active ? (
                      <Ban className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-500"
                    onClick={() => setDeleteConfirm(patient)}
                    aria-label="Delete patient"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
          <p className="text-sm text-muted-foreground">
            No patients found matching &quot;{search}&quot;
          </p>
        </div>
      )}

      {/* Patient Profile Dialog */}
      <Dialog open={selectedPatient !== null} onOpenChange={() => setSelectedPatient(null)}>
        {selectedPatient && (
          <DialogContent
            onClose={() => setSelectedPatient(null)}
            className="max-w-lg max-h-[80vh] overflow-y-auto"
          >
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
                    {selectedPatient.gender === "M" ? "Male" : "Female"}, {selectedPatient.age}{" "}
                    years old
                  </p>
                  <p className="text-xs text-muted-foreground">
                    DOB: {selectedPatient.dateOfBirth}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <DataMask value={selectedPatient.phone} type="phone" className="font-medium" />
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <DataMask
                    value={selectedPatient.email}
                    type="email"
                    className="font-medium text-xs"
                  />
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
                      <Badge key={a} variant="destructive" className="text-xs">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Tabs defaultValue="appointments">
                <TabsList className="w-full">
                  <TabsTrigger value="appointments" className="flex-1">
                    Appointments
                  </TabsTrigger>
                  <TabsTrigger value="prescriptions" className="flex-1">
                    Prescriptions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="appointments">
                  <div className="space-y-2 mt-2">
                    {getPatientAppts(selectedPatient.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No appointments
                      </p>
                    )}
                    {getPatientAppts(selectedPatient.id).map((appt) => (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between border rounded-lg p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{appt.serviceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {appt.doctorName} — {appt.date} at {appt.time}
                          </p>
                        </div>
                        <Badge
                          variant={
                            appt.status === "completed"
                              ? "default"
                              : appt.status === "cancelled"
                                ? "destructive"
                                : appt.status === "no-show"
                                  ? "destructive"
                                  : "secondary"
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
                    {rxLoading && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Loading prescriptions…
                      </p>
                    )}
                    {!rxLoading && prescriptions.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No prescriptions
                      </p>
                    )}
                    {!rxLoading &&
                      prescriptions.map((rx) => (
                        <div key={rx.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium flex items-center gap-1">
                              <Pill className="h-3.5 w-3.5" />
                              {rx.doctorName}
                            </p>
                            <span className="text-xs text-muted-foreground">{rx.date}</span>
                          </div>
                          <div className="space-y-1">
                            {rx.medications.map((med) => (
                              <p
                                key={`${rx.id}-${med.name}-${med.dosage}-${med.duration}`}
                                className="text-xs text-muted-foreground"
                              >
                                <span className="font-medium text-foreground">{med.name}</span> —{" "}
                                {med.dosage} for {med.duration}
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

      {/* Edit Patient Dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent onClose={() => setEditing(null)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>Update the patient&apos;s contact details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Insurance</Label>
              <Input value={formInsurance} onChange={(e) => setFormInsurance(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Patient Dialog */}
      <Dialog
        open={adding}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            resetAddForm();
          }
        }}
      >
        <DialogContent
          onClose={() => {
            setAdding(false);
            resetAddForm();
          }}
          className="max-w-md"
        >
          <DialogHeader>
            <DialogTitle>{t(locale, "admin.patients.add")}</DialogTitle>
            <DialogDescription>{t(locale, "admin.patients.addDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Patient name"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="+212 6XX XX XX XX"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={addDob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setAddDob(e.target.value)}
                disabled={creating}
              />
            </div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setAdding(false);
                resetAddForm();
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !addName.trim() || !addPhone.trim()}
            >
              {creating && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
              {t(locale, "admin.patients.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Patient</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove {deleteConfirm?.name}? This deletes their
              record and cannot be undone. Consider deactivating instead to preserve history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
