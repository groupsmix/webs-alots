"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { PhysioSessionTracker } from "@/components/para-medical/physio-session-tracker";
import { getCurrentUser } from "@/lib/data/client";
import type { PhysioSession } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function PhysioSessionsPage() {
  const [sessions, setSessions] = useState<PhysioSession[]>([]);
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
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Session Tracking</h1>
      </div>
      <PhysioSessionTracker sessions={sessions} />
    </div>
  );
}
