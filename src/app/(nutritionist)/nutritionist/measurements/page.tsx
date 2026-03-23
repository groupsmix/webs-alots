"use client";

import { useState, useEffect } from "react";
import { Scale } from "lucide-react";
import { BodyMeasurementTracker } from "@/components/para-medical/body-measurement-tracker";
import { getCurrentUser } from "@/lib/data/client";
import type { BodyMeasurement } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function MeasurementsPage() {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setMeasurements([]);
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
    return <PageLoader message="Loading measurements..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Scale className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Body Measurements</h1>
      </div>
      <BodyMeasurementTracker measurements={measurements} />
    </div>
  );
}
