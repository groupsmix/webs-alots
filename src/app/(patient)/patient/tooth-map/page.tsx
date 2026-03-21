"use client";

import { useState, useEffect, useCallback } from "react";
import { OdontogramChart } from "@/components/dental/odontogram-chart";
import {
  getCurrentUser,
  fetchOdontogram,
  type OdontogramView,
} from "@/lib/data/client";

export default function PatientToothMapPage() {
  const [entries, setEntries] = useState<OdontogramView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchOdontogram(user.clinic_id, user.id);
    setEntries(data);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading tooth map...</p>
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
