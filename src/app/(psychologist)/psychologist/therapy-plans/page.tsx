"use client";

import { useState, useEffect, useCallback } from "react";
import { Target } from "lucide-react";
import { TherapyPlanView } from "@/components/para-medical/therapy-plan-view";
import { getCurrentUser } from "@/lib/data/client";
import type { TherapyPlan } from "@/lib/types/para-medical";

export default function TherapyPlansPage() {
  const [plans, setPlans] = useState<TherapyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    setPlans([]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading therapy plans...</p>
      </div>
    );
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
