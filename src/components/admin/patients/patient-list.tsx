"use client";

import { User } from "lucide-react";
import * as React from "react";
import { DataList, type DataListColumn } from "@/components/dashboard/data-list";
import { DataTable, type DataTableColumn } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { DataMask } from "@/components/ui/data-mask";
import { EmptyState } from "@/components/ui/empty-state";
import type { AppointmentView, PatientView } from "@/lib/data/client";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface PatientListProps {
  patients: PatientView[];
  appointments: AppointmentView[];
  locale: Locale;
  onRowClick?: (patient: PatientView) => void;
  onEdit?: (patient: PatientView) => void;
  onToggleActive?: (patient: PatientView) => void;
  onDelete?: (patient: PatientView) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

function getLastVisit(
  patientId: string,
  appointments: AppointmentView[],
): AppointmentView | undefined {
  return appointments
    .filter((a) => a.patientId === patientId && (a.status === "completed" || a.date))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

function ageGenderLabel(patient: PatientView, locale: Locale): string {
  const gender =
    patient.gender === "M"
      ? t(locale, "admin.patients.genderMale")
      : t(locale, "admin.patients.genderFemale");
  return `${patient.age} · ${gender}`;
}

export function PatientList({
  patients,
  appointments,
  locale,
  onRowClick,
  onEdit,
  onToggleActive,
  onDelete,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: PatientListProps) {
  const lastVisitByPatient = React.useMemo(() => {
    const map = new Map<string, AppointmentView | undefined>();
    for (const patient of patients) {
      map.set(patient.id, getLastVisit(patient.id, appointments));
    }
    return map;
  }, [patients, appointments]);

  const tableColumns: DataTableColumn<PatientView>[] = [
    {
      id: "name",
      header: t(locale, "admin.patients.columns.name"),
      cell: (patient) => <span className="font-medium text-foreground">{patient.name}</span>,
      sortable: true,
    },
    {
      id: "phone",
      header: t(locale, "admin.patients.columns.phone"),
      cell: (patient) => <DataMask value={patient.phone} type="phone" />,
    },
    {
      id: "ageGender",
      header: t(locale, "admin.patients.columns.ageGender"),
      cell: (patient) => ageGenderLabel(patient, locale),
      sortable: true,
    },
    {
      id: "lastVisit",
      header: t(locale, "admin.patients.columns.lastVisit"),
      cell: (patient) => {
        const visit = lastVisitByPatient.get(patient.id);
        return visit ? (
          <span className="text-sm">{visit.date}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
      sortFn: (a, b) => {
        const aDate = lastVisitByPatient.get(a.id)?.date ?? "";
        const bDate = lastVisitByPatient.get(b.id)?.date ?? "";
        return aDate.localeCompare(bDate);
      },
      sortable: true,
    },
    {
      id: "insurance",
      header: t(locale, "admin.patients.columns.insurance"),
      cell: (patient) => patient.insurance || <span className="text-muted-foreground">—</span>,
    },
    {
      id: "status",
      header: t(locale, "admin.patients.columns.status"),
      cell: (patient) => (
        <Badge variant={patient.active ? "success" : "secondary"}>
          {patient.active
            ? t(locale, "admin.patients.status.active")
            : t(locale, "admin.patients.status.inactive")}
        </Badge>
      ),
    },
  ];

  const listColumns: DataListColumn<PatientView>[] = [
    {
      id: "name",
      header: t(locale, "admin.patients.columns.name"),
      cell: (patient) => patient.name,
      primary: true,
    },
    {
      id: "phone",
      header: t(locale, "admin.patients.columns.phone"),
      cell: (patient) => <DataMask value={patient.phone} type="phone" />,
    },
    {
      id: "ageGender",
      header: t(locale, "admin.patients.columns.ageGender"),
      cell: (patient) => ageGenderLabel(patient, locale),
    },
    {
      id: "lastVisit",
      header: t(locale, "admin.patients.columns.lastVisit"),
      cell: (patient) => {
        const visit = lastVisitByPatient.get(patient.id);
        return visit ? visit.date : "—";
      },
    },
    {
      id: "insurance",
      header: t(locale, "admin.patients.columns.insurance"),
      cell: (patient) => patient.insurance || "—",
    },
    {
      id: "status",
      header: t(locale, "admin.patients.columns.status"),
      cell: (patient) => (
        <Badge variant={patient.active ? "success" : "secondary"}>
          {patient.active
            ? t(locale, "admin.patients.status.active")
            : t(locale, "admin.patients.status.inactive")}
        </Badge>
      ),
    },
  ];

  const rowActions = (patient: PatientView) => {
    const actions: { label: string; onClick: (p: PatientView) => void; destructive?: boolean }[] =
      [];
    if (onEdit) {
      actions.push({ label: t(locale, "admin.patients.actions.edit"), onClick: onEdit });
    }
    if (onToggleActive) {
      actions.push({
        label: patient.active
          ? t(locale, "admin.patients.actions.deactivate")
          : t(locale, "admin.patients.actions.activate"),
        onClick: onToggleActive,
      });
    }
    if (onDelete) {
      actions.push({
        label: t(locale, "admin.patients.actions.delete"),
        onClick: onDelete,
        destructive: true,
      });
    }
    return actions;
  };

  if (patients.length === 0) {
    return (
      <EmptyState
        icon={User}
        title={emptyTitle ?? t(locale, "admin.patients.emptyTitle")}
        description={emptyDescription ?? t(locale, "admin.patients.emptyDescription")}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      <DataTable
        data={patients}
        columns={tableColumns}
        keyExtractor={(patient) => patient.id}
        rowActions={rowActions}
        onRowClick={onRowClick}
        ariaLabel={t(locale, "admin.nav.patients")}
        className="hidden md:block"
      />
      <DataList
        data={patients}
        columns={listColumns}
        keyExtractor={(patient) => patient.id}
        rowActions={rowActions}
        onRowClick={onRowClick}
        ariaLabel={t(locale, "admin.nav.patients")}
        className="md:hidden"
      />
    </>
  );
}
