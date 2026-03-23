"use client";

import { useState, useEffect } from "react";
import { Target } from "lucide-react";
import { TherapyPlanView } from "@/components/para-medical/therapy-plan-view";
import { getCurrentUser } from "@/lib/data/client";
import type { TherapyPlan } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function TherapyPlansPage() {
  const [plans, setPlans] = useState<TherapyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setPlans([]);
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
    return <PageLoader message="Loading therapy plans..." />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Target className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-bold">Therapy Plans</h1>
      </div>
      <TherapyPlanView plans={plans} editable />
    </div>
  );
}
