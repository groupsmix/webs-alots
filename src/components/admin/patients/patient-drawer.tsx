"use client";

import { Calendar, Pill, Stethoscope } from "lucide-react";
import * as React from "react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataMask } from "@/components/ui/data-mask";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AppointmentView,
  ConsultationNoteView,
  PatientView,
  PrescriptionView,
  TimelineEvent,
} from "@/lib/data/client";
import {
  fetchConsultationNotes,
  fetchPatientPrescriptions,
  fetchPatientTimeline,
} from "@/lib/data/client";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface PatientDrawerProps {
  patient: PatientView | null;
  appointments: AppointmentView[];
  clinicId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  locale: Locale;
}

function appointmentStatusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "completed") return "default";
  if (status === "cancelled" || status === "no_show" || status === "no-show") return "destructive";
  return "secondary";
}

function formatEventType(type: string, locale: Locale): string {
  const key = `admin.patients.timeline.type.${type}`;
  const translated = t(locale, key);
  return translated === key ? type : translated;
}

export function PatientDrawer({
  patient,
  appointments,
  clinicId,
  open,
  onOpenChange,
  onEdit,
  onToggleActive,
  onDelete,
  locale,
}: PatientDrawerProps) {
  const [prescriptions, setPrescriptions] = React.useState<PrescriptionView[] | undefined>();
  const [timeline, setTimeline] = React.useState<TimelineEvent[] | undefined>();
  const [notes, setNotes] = React.useState<ConsultationNoteView[] | undefined>();

  const patientAppointments = React.useMemo(() => {
    if (!patient) return [];
    return appointments
      .filter((a) => a.patientId === patient.id)
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  }, [appointments, patient]);

  React.useEffect(() => {
    if (!open || !patient || !clinicId) return;

    fetchPatientPrescriptions(clinicId, patient.id)
      .then(setPrescriptions)
      .catch(() => setPrescriptions([]));

    fetchPatientTimeline({ patientId: patient.id, limit: 50 })
      .then((res) => setTimeline(res.events))
      .catch(() => setTimeline([]));

    fetchConsultationNotes(clinicId)
      .then((all) =>
        setNotes(
          all
            .filter((n) => n.patientId === patient.id)
            .sort((a, b) => b.date.localeCompare(a.date)),
        ),
      )
      .catch(() => setNotes([]));
  }, [open, patient, clinicId]);

  if (!patient) return null;

  const description = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <DataMask value={patient.phone} type="phone" />
        {patient.email && <span className="text-muted-foreground">·</span>}
        {patient.email && <DataMask value={patient.email} type="email" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={patient.active ? "success" : "secondary"}>
          {patient.active
            ? t(locale, "admin.patients.status.active")
            : t(locale, "admin.patients.status.inactive")}
        </Badge>
        {patient.insurance && <Badge variant="outline">{patient.insurance}</Badge>}
      </div>
    </div>
  );

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={onEdit}>
        {t(locale, "admin.patients.actions.edit")}
      </Button>
      <Button variant="outline" onClick={onToggleActive}>
        {patient.active
          ? t(locale, "admin.patients.actions.deactivate")
          : t(locale, "admin.patients.actions.activate")}
      </Button>
      <Button variant="destructive" onClick={onDelete}>
        {t(locale, "admin.patients.actions.delete")}
      </Button>
    </div>
  );

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={patient.name}
      description={description}
      footer={footer}
      ariaLabel={t(locale, "admin.patients.drawer.title")}
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">
            {t(locale, "admin.patients.drawer.phone")}
          </p>
          <DataMask value={patient.phone} type="phone" className="font-medium" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t(locale, "admin.patients.drawer.email")}
          </p>
          <p className="font-medium">{patient.email || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t(locale, "admin.patients.drawer.registered")}
          </p>
          <p className="font-medium">{patient.registeredAt}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t(locale, "admin.patients.drawer.balance")}
          </p>
          <p className="font-medium">—</p>
        </div>
      </div>

      {patient.allergies && patient.allergies.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            {t(locale, "admin.patients.drawer.allergies")}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {patient.allergies.map((allergy) => (
              <Badge key={allergy} variant="destructive">
                {allergy}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="appointments" className="mt-6">
        <TabsList className="w-full">
          <TabsTrigger value="appointments" className="flex-1">
            {t(locale, "admin.patients.tabs.appointments")}
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="flex-1">
            {t(locale, "admin.patients.tabs.prescriptions")}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex-1">
            {t(locale, "admin.patients.tabs.timeline")}
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1">
            {t(locale, "admin.patients.tabs.notes")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="mt-3">
          {patientAppointments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={t(locale, "admin.patients.appointments.empty")}
              variant="plain"
            />
          ) : (
            <ul
              className="space-y-2"
              role="list"
              aria-label={t(locale, "admin.patients.tabs.appointments")}
            >
              {patientAppointments.map((appt) => (
                <li key={appt.id}>
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{appt.serviceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {appt.doctorName} · {appt.date} · {appt.time}
                          </p>
                        </div>
                        <Badge variant={appointmentStatusVariant(appt.status)}>{appt.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-3">
          {prescriptions === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : prescriptions.length === 0 ? (
            <EmptyState
              icon={Pill}
              title={t(locale, "admin.patients.prescriptions.empty")}
              variant="plain"
            />
          ) : (
            <ul
              className="space-y-2"
              role="list"
              aria-label={t(locale, "admin.patients.tabs.prescriptions")}
            >
              {prescriptions.map((rx) => (
                <li key={rx.id}>
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{rx.doctorName}</p>
                        <span className="text-xs text-muted-foreground">{rx.date}</span>
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {rx.medications.map((med) => (
                          <li
                            key={`${med.name}-${med.dosage}`}
                            className="text-xs text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">{med.name}</span> —{" "}
                            {med.dosage} · {med.duration}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-3">
          {timeline === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : timeline.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={t(locale, "admin.patients.timeline.empty")}
              variant="plain"
            />
          ) : (
            <ul
              className="space-y-2"
              role="list"
              aria-label={t(locale, "admin.patients.tabs.timeline")}
            >
              {timeline.map((event) => (
                <li key={event.id}>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">
                        {formatEventType(event.event_type, locale)}
                      </p>
                      <p className="text-xs text-muted-foreground">{event.event_date}</p>
                      {Object.keys(event.metadata).length > 0 && (
                        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          {Object.entries(event.metadata).map(([k, v]) => (
                            <div key={k}>
                              <dt className="text-muted-foreground">{k}</dt>
                              <dd className="truncate text-foreground">{String(v)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-3">
          {notes === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : notes.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title={t(locale, "admin.patients.notes.empty")}
              variant="plain"
            />
          ) : (
            <ul
              className="space-y-2"
              role="list"
              aria-label={t(locale, "admin.patients.tabs.notes")}
            >
              {notes.map((note) => (
                <li key={note.id}>
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{note.doctorName}</p>
                        <span className="text-xs text-muted-foreground">{note.date}</span>
                      </div>
                      {note.diagnosis && (
                        <p className="mt-1 text-sm text-foreground">{note.diagnosis}</p>
                      )}
                      {note.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{note.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </DetailDrawer>
  );
}
