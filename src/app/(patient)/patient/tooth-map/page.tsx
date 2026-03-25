"use client";

import { useState, useEffect } from "react";
import { OdontogramChart } from "@/components/dental/odontogram-chart";
import {
  getCurrentUser,
  fetchOdontogram,
  type OdontogramView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function PatientToothMapPage() {
  const [entries, setEntries] = useState<OdontogramView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchOdontogram(user.clinic_id, user.id);
      if (controller.signal.aborted) return;
    setEntries(data);
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
    return <PageLoader message="Loading tooth map..." />;
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Tooth Map</h1>
      <p className="text-sm text-muted-foreground">
        Visual overview of your dental health. Click on any tooth for details.
      </p>
      {entries.length > 0 ? (
        <OdontogramChart entries={entries.map(e => ({ toothNumber: e.toothNumber, status: e.status as "healthy" | "decayed" | "filled" | "missing" | "crown" | "implant" | "root_canal" | "extraction_needed", notes: e.notes ?? "", lastUpdated: e.lastUpdated ?? "" }))} editable={false} />
      ) : (
        <p className="text-muted-foreground">No dental records found.</p>
      )}
    </div>
  );
}
