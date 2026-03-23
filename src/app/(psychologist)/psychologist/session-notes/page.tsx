"use client";

import { useState, useEffect } from "react";
import { Brain } from "lucide-react";
import { TherapySessionNotes } from "@/components/para-medical/therapy-session-notes";
import { getCurrentUser } from "@/lib/data/client";
import type { TherapySessionNote } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function SessionNotesPage() {
  const [sessions, setSessions] = useState<TherapySessionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setSessions([]);
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
    return <PageLoader message="Loading session notes..." />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-bold">Therapy Session Notes</h1>
      </div>
      <TherapySessionNotes sessions={sessions} />
    </div>
  );
}
