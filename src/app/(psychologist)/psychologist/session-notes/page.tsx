"use client";

import { useState, useEffect, useCallback } from "react";
import { Brain } from "lucide-react";
import { TherapySessionNotes } from "@/components/para-medical/therapy-session-notes";
import { getCurrentUser } from "@/lib/data/client";
import type { TherapySessionNote } from "@/lib/types/para-medical";

export default function SessionNotesPage() {
  const [sessions, setSessions] = useState<TherapySessionNote[]>([]);
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
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading session notes...</p>
      </div>
    );
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
