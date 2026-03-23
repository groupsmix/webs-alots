"use client";

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { OpticalPrescriptionTracker } from "@/components/para-medical/optical-prescription-tracker";
import { getCurrentUser } from "@/lib/data/client";
import type { OpticalPrescription } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function OpticalPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<OpticalPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setPrescriptions([]);
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

  if (loading) {
    return <PageLoader message="Loading prescriptions..." />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Optical Prescriptions</h1>
      </div>
      <OpticalPrescriptionTracker prescriptions={prescriptions} editable />
    </div>
  );
}
