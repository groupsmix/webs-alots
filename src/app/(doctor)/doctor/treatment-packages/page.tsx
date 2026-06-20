"use client";

import { useState, useEffect } from "react";
import { TreatmentPackages } from "@/components/aesthetic/treatment-packages";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchTreatmentPackages,
  createTreatmentPackage,
  recordPatientPackageSession,
  type TreatmentPackageView,
  type PatientPackageView,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function DoctorTreatmentPackagesPage() {
  const { addToast } = useToast();
  const [packages, setPackages] = useState<TreatmentPackageView[]>([]);
  const [patientPackages, setPatientPackages] = useState<PatientPackageView[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
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
      setClinicId(user.clinic_id);
      const data = await fetchTreatmentPackages(user.clinic_id);
      if (controller.signal.aborted) return;
      setPackages(data.packages);
      setPatientPackages(data.patientPackages);
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

  async function handleAddPackage(data: {
    name: string;
    description: string;
    totalSessions: number;
    price: number;
    discountPercent: number;
  }) {
    if (!clinicId) return;
    try {
      const { id } = await createTreatmentPackage(clinicId, data);
      setPackages((prev) => [
        ...prev,
        {
          id,
          name: data.name,
          description: data.description || null,
          totalSessions: data.totalSessions,
          price: data.price,
          discountPercent: data.discountPercent,
          isActive: true,
          subscriberCount: 0,
        },
      ]);
      addToast("Treatment package created", "success");
    } catch (err) {
      logger.warn("Failed to create treatment package", {
        context: "doctor/treatment-packages",
        error: err,
      });
      addToast("Failed to create package. Please try again.", "error");
    }
  }

  async function handleRecordSession(patientPackageId: string) {
    if (!clinicId) return;
    const previous = patientPackages;
    setPatientPackages((prev) =>
      prev.map((pp) => {
        if (pp.id !== patientPackageId) return pp;
        const newUsed = pp.sessionsUsed + 1;
        return {
          ...pp,
          sessionsUsed: newUsed,
          status: newUsed >= pp.sessionsTotal ? "completed" : pp.status,
        } as PatientPackageView;
      }),
    );
    try {
      await recordPatientPackageSession(clinicId, patientPackageId);
      addToast("Session recorded", "success");
    } catch (err) {
      logger.warn("Failed to record session", {
        context: "doctor/treatment-packages",
        error: err,
      });
      setPatientPackages(previous);
      addToast("Failed to record session. Please try again.", "error");
    }
  }

  if (loading) return <PageLoader message="Loading treatment packages..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load treatment packages.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Treatment Packages" }]}
      />
      <h1 className="text-2xl font-bold">Treatment Packages</h1>
      <TreatmentPackages
        packages={packages}
        patientPackages={patientPackages}
        editable
        onAddPackage={handleAddPackage}
        onRecordSession={handleRecordSession}
      />
    </div>
  );
}
