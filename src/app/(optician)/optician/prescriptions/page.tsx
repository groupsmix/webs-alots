"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import { OpticalPrescriptionTracker } from "@/components/para-medical/optical-prescription-tracker";
import { getCurrentUser } from "@/lib/data/client";
import type { OpticalPrescription } from "@/lib/types/para-medical";

export default function OpticalPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<OpticalPrescription[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    setPrescriptions([]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading prescriptions...</p>
      </div>
    );
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
