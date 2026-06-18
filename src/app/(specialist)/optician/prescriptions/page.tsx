"use client";

import { FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { OpticalPrescriptionTracker } from "@/components/para-medical/optical-prescription-tracker";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchOpticalPrescriptions,
  updateOpticalPrescriptionStatus,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { OpticalPrescription } from "@/lib/types/para-medical";

export default function OpticalPrescriptionsPage() {
  const { addToast } = useToast();
  const [prescriptions, setPrescriptions] = useState<OpticalPrescription[]>([]);
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
      const data = await fetchOpticalPrescriptions(user.clinic_id);
      if (controller.signal.aborted) return;
      setPrescriptions(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        logger.warn("Failed to load optical prescriptions", {
          context: "optician/prescriptions",
          error: err,
        });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function handleUpdateStatus(id: string, status: OpticalPrescription["status"]) {
    if (!clinicId) return;
    const previous = prescriptions;
    setPrescriptions((current: OpticalPrescription[]) =>
      current.map((rx: OpticalPrescription) => (rx.id === id ? { ...rx, status } : rx)),
    );
    try {
      await updateOpticalPrescriptionStatus(clinicId, id, status);
      addToast("Prescription status updated", "success");
    } catch (err) {
      logger.warn("Failed to update prescription status", {
        context: "optician/prescriptions",
        error: err,
      });
      setPrescriptions(previous);
      addToast("Failed to update status", "error");
    }
  }

  if (loading) return <PageLoader message="Loading prescriptions..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load prescriptions.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Optical Prescriptions</h1>
      </div>
      <OpticalPrescriptionTracker
        prescriptions={prescriptions}
        editable
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
