"use client";

import { useState } from "react";
import { SterilizationLogPanel } from "@/components/dental/sterilization-log-panel";
import { sterilizationLog as initialLog, type SterilizationEntry } from "@/lib/dental-demo-data";

export default function DoctorSterilizationPage() {
  const [log, setLog] = useState<SterilizationEntry[]>(initialLog);

  const handleAddEntry = (entry: Omit<SterilizationEntry, "id" | "sterilizedAt">) => {
    const newEntry: SterilizationEntry = {
      ...entry,
      id: `st${log.length + 1}`,
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
