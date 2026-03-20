"use client";

import { useState, useEffect, useCallback } from "react";
import { SterilizationLogPanel } from "@/components/dental/sterilization-log-panel";
import { getCurrentUser, fetchSterilizationLog, createSterilizationEntry } from "@/lib/data/client";
import type { SterilizationEntry } from "@/lib/types/dental";

export default function DoctorSterilizationPage() {
  const [log, setLog] = useState<SterilizationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchSterilizationLog(user.clinic_id);
    setLog(data as unknown as SterilizationEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading sterilization log...</p>
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
