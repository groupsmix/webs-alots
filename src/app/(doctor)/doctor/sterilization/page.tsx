"use client";

import { useState, useEffect } from "react";
import { SterilizationLogPanel } from "@/components/dental/sterilization-log-panel";
import { getCurrentUser, fetchSterilizationLog, createSterilizationEntry } from "@/lib/data/client";
import type { SterilizationEntry } from "@/lib/types/dental";
import { PageLoader } from "@/components/ui/page-loader";

export default function DoctorSterilizationPage() {
  const [log, setLog] = useState<SterilizationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchSterilizationLog(user.clinic_id);
      if (controller.signal.aborted) return;
    setLog(data as SterilizationEntry[]);
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
    return <PageLoader message="Loading sterilization log..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  const handleAddEntry = async (entry: Omit<SterilizationEntry, "id" | "sterilizedAt">) => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;

    const newId = await createSterilizationEntry({
      clinic_id: user.clinic_id,
      tool_name: entry.toolName,
      sterilized_by: entry.sterilizedBy,
      method: entry.method,
      notes: entry.notes,
      next_due: entry.nextDue ?? undefined,
      batch_number: entry.batchNumber,
      cycle_number: entry.cycleNumber,
    });

    const newEntry: SterilizationEntry = {
      ...entry,
      id: newId ?? `st${log.length + 1}`,
      sterilizedAt: new Date().toISOString(),
    };
    setLog((prev) => [newEntry, ...prev]);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sterilization Log</h1>
      <SterilizationLogPanel entries={log} onAddEntry={handleAddEntry} />
    </div>
  );
}
