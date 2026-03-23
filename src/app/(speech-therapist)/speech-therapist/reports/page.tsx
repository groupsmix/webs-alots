"use client";

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { SpeechProgressReports } from "@/components/para-medical/speech-progress-reports";
import { getCurrentUser } from "@/lib/data/client";
import type { SpeechProgressReport } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function SpeechReportsPage() {
  const [reports, setReports] = useState<SpeechProgressReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setReports([]);
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
    return <PageLoader message="Loading reports..." />;
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
        <FileText className="h-6 w-6 text-teal-600" />
        <h1 className="text-2xl font-bold">Progress Reports</h1>
      </div>
      <SpeechProgressReports reports={reports} />
    </div>
  );
}
