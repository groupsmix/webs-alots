"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { SpeechSessionTracker } from "@/components/para-medical/speech-session-tracker";
import { getCurrentUser } from "@/lib/data/client";
import type { SpeechSession } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function SpeechSessionsPage() {
  const [sessions, setSessions] = useState<SpeechSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    setSessions([]);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return <PageLoader message="Loading sessions..." />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="h-6 w-6 text-teal-600" />
        <h1 className="text-2xl font-bold">Session Tracking</h1>
      </div>
      <SpeechSessionTracker sessions={sessions} />
    </div>
  );
}
