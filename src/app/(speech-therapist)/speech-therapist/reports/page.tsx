"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import { SpeechProgressReports } from "@/components/para-medical/speech-progress-reports";
import { getCurrentUser } from "@/lib/data/client";
import type { SpeechProgressReport } from "@/lib/types/para-medical";

export default function SpeechReportsPage() {
  const [reports, setReports] = useState<SpeechProgressReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    setReports([]);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading reports...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-6 w-6 text-teal-600" />
        <h1 className="text-2xl font-bold">Progress Reports</h1>
      </div>
      <SpeechProgressReports reports={reports} />
    </div>
  );
}
