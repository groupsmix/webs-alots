"use client";

import { Scale } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { getCurrentUser } from "@/lib/data/client";

const BodyMeasurementTracker = dynamic(
  () => import("@/components/para-medical/body-measurement-tracker").then((m) => m.BodyMeasurementTracker),
  { ssr: false, loading: () => <div className="h-[400px] animate-pulse bg-muted rounded-lg" /> },
);
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
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
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
