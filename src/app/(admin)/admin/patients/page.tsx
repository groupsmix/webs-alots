"use client";

import { Download, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { PatientDeleteDialog } from "@/components/admin/patients/patient-delete-dialog";
import { PatientDrawer } from "@/components/admin/patients/patient-drawer";
import {
  PatientFormDialog,
  type PatientFormData,
} from "@/components/admin/patients/patient-form-dialog";
import { PatientList } from "@/components/admin/patients/patient-list";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { updateClinicUser, setClinicUserActive, deleteClinicUser } from "@/lib/admin-actions";
import {
  getCurrentUser,
  fetchPatients,
  fetchAppointments,
  type PatientView,
  type AppointmentView,
} from "@/lib/data/client";
import { exportPatients } from "@/lib/export-data";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";

type Patient = PatientView;

function normalizeSearch(value: string): string {
  return value.toLowerCase().trim();
}

function StatusFilter({
  value,
  onChange,
  locale,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder={t(locale, "admin.patients.filters.status")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t(locale, "admin.patients.filters.allStatuses")}</SelectItem>
        <SelectItem value="active">{t(locale, "admin.patients.status.active")}</SelectItem>
        <SelectItem value="inactive">{t(locale, "admin.patients.status.inactive")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function InsuranceFilter({
  value,
  onChange,
  options,
  locale,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  locale: Locale;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={t(locale, "admin.patients.filters.insurance")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t(locale, "admin.patients.filters.allInsurances")}</SelectItem>
        {options.map((insurance) => (
          <SelectItem key={insurance} value={insurance}>
            {insurance}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function AdminPatientDatabasePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [insuranceFilter, setInsuranceFilter] = useState("all");

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addError, setAddError] = useState("");

  const [locale] = useLocale();
  const { addToast } = useToast();

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
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const sinceDate = twoYearsAgo.toISOString().slice(0, 10);
      const [p, a] = await Promise.all([
        fetchPatients(user.clinic_id),
        fetchAppointments(user.clinic_id, { sinceDate }),
      ]);
      if (controller.signal.aborted) return;
      setPatients(p);
      setAppointments(a);
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

  const insuranceOptions = Array.from(
    new Set(patients.map((p) => p.insurance).filter((ins): ins is string => Boolean(ins))),
  ).sort();

  const normalizedSearch = normalizeSearch(search);
  const filtered = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(normalizedSearch) ||
      p.phone.includes(normalizedSearch) ||
      p.email.toLowerCase().includes(normalizedSearch);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && p.active) ||
      (statusFilter === "inactive" && !p.active);
    const matchesInsurance = insuranceFilter === "all" || p.insurance === insuranceFilter;
    return matchesSearch && matchesStatus && matchesInsurance;
  });

  const handleSaveEdit = async (data: PatientFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateClinicUser(editing.id, {
        name: data.name,
        phone: data.phone,
        email: data.email,
        metadata: data.insurance ? { insurance: data.insurance } : undefined,
      });
      setPatients((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? {
                ...p,
                name: data.name,
                phone: data.phone,
                email: data.email,
                insurance: data.insurance,
              }
            : p,
        ),
      );
      addToast(t(locale, "admin.patients.toast.updated"), "success");
      setEditing(null);
    } catch (err) {
      logger.warn("Failed to update patient", { context: "admin/patients", error: err });
      addToast(t(locale, "admin.patients.toast.updateFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (data: PatientFormData) => {
    if (!data.name.trim() || !data.phone.trim()) return;
    setCreating(true);
    setAddError("");
    try {
      const res = await fetch("/api/receptionist/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          phone: data.phone.trim(),
          email: data.email.trim() || undefined,
          dateOfBirth: data.dateOfBirth,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { patient?: { id: string; name: string; phone: string }; existing?: boolean };
        error?: string;
      } | null;
      if (!res.ok || !json?.data?.patient) {
        setAddError(json?.error ?? t(locale, "admin.patients.toast.createFailed"));
        return;
      }
      const created = json.data.patient;
      if (json.data.existing) {
        addToast(t(locale, "admin.patients.toast.existing"), "info");
      } else {
        const newPatient: Patient = {
          id: created.id,
          name: created.name,
          phone: created.phone,
          email: data.email.trim(),
          age: 0,
          gender: "M",
          dateOfBirth: data.dateOfBirth || "",
          registeredAt: new Date().toISOString().slice(0, 10),
          active: true,
        };
        setPatients((prev) => {
          if (prev.some((p) => p.id === created.id)) return prev;
          return [newPatient, ...prev];
        });
        addToast(t(locale, "admin.patients.toast.created"), "success");
      }
      setAdding(false);
    } catch (err) {
      logger.warn("Failed to add patient", { context: "admin/patients", error: err });
      setAddError(t(locale, "admin.patients.toast.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (patient: Patient) => {
    const next = !patient.active;
    setPatients((prev) => prev.map((p) => (p.id === patient.id ? { ...p, active: next } : p)));
    setSelectedPatient((prev) => (prev?.id === patient.id ? { ...prev, active: next } : prev));
    try {
      await setClinicUserActive(patient.id, next);
      addToast(
        next
          ? t(locale, "admin.patients.toast.activated")
          : t(locale, "admin.patients.toast.deactivated"),
        "success",
      );
    } catch (err) {
      logger.warn("Failed to toggle patient", { context: "admin/patients", error: err });
      setPatients((prev) => prev.map((p) => (p.id === patient.id ? { ...p, active: !next } : p)));
      setSelectedPatient((prev) => (prev?.id === patient.id ? { ...prev, active: !next } : prev));
      addToast(t(locale, "admin.patients.toast.statusFailed"), "error");
    }
  };

  const handleDelete = async (patient: Patient) => {
    const previous = patients;
    setPatients((prev) => prev.filter((p) => p.id !== patient.id));
    setSelectedPatient(null);
    setDeleteConfirm(null);
    try {
      await deleteClinicUser(patient.id);
      addToast(t(locale, "admin.patients.toast.deleted"), "success");
    } catch (err) {
      logger.warn("Failed to delete patient", { context: "admin/patients", error: err });
      setPatients(previous);
      addToast(t(locale, "admin.patients.toast.deleteFailed"), "error");
    }
  };

  if (loading) {
    return <PageLoader message={t(locale, "admin.patients.loading")} />;
  }

  if (error) {
    return (
      <EmptyState
        icon={UserPlus}
        title={t(locale, "admin.patients.errorTitle")}
        description={error.message}
        action={
          <Button onClick={() => window.location.reload()}>
            {t(locale, "admin.patients.retry")}
          </Button>
        }
      />
    );
  }

  const editInitial = editing
    ? {
        name: editing.name,
        phone: editing.phone,
        email: editing.email,
        insurance: editing.insurance ?? "",
      }
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "admin.patients.title")}
        subtitle={t(locale, "admin.patients.subtitle")}
        primaryAction={
          <Button
            onClick={() => {
              setAddError("");
              setAdding(true);
            }}
          >
            <UserPlus className="me-2 h-4 w-4" />
            {t(locale, "admin.patients.add")}
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t(locale, "admin.patients.searchPlaceholder")}
      >
        <StatusFilter value={statusFilter} onChange={setStatusFilter} locale={locale} />
        <InsuranceFilter
          value={insuranceFilter}
          onChange={setInsuranceFilter}
          options={insuranceOptions}
          locale={locale}
        />
        <Button variant="outline" size="sm" onClick={() => exportPatients(filtered)}>
          <Download className="me-2 h-4 w-4" />
          {t(locale, "admin.patients.export")}
        </Button>
      </FilterBar>

      <PatientList
        patients={filtered}
        appointments={appointments}
        locale={locale}
        onRowClick={setSelectedPatient}
        onEdit={setEditing}
        onToggleActive={handleToggleActive}
        onDelete={setDeleteConfirm}
      />

      <PatientDrawer
        key={selectedPatient?.id ?? "drawer-closed"}
        patient={selectedPatient}
        appointments={appointments}
        clinicId={clinicId}
        open={selectedPatient !== null}
        onOpenChange={(open) => !open && setSelectedPatient(null)}
        onEdit={() => {
          if (selectedPatient) {
            setEditing(selectedPatient);
          }
        }}
        onToggleActive={() => selectedPatient && handleToggleActive(selectedPatient)}
        onDelete={() => selectedPatient && setDeleteConfirm(selectedPatient)}
        locale={locale}
      />

      <PatientFormDialog
        key={editing?.id ?? "edit-closed"}
        mode="edit"
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initialData={editInitial}
        onSave={handleSaveEdit}
        saving={saving}
        locale={locale}
      />

      <PatientFormDialog
        key={adding ? "add-open" : "add-closed"}
        mode="add"
        open={adding}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setAddError("");
          }
        }}
        onSave={handleCreate}
        saving={creating}
        error={addError}
        locale={locale}
      />

      <PatientDeleteDialog
        patient={deleteConfirm}
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        locale={locale}
      />
    </div>
  );
}
