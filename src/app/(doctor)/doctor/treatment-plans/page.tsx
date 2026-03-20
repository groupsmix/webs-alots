"use client";

import { useState, useEffect, useCallback } from "react";
import { TreatmentPlanBuilder } from "@/components/dental/treatment-plan-builder";
import { getCurrentUser, fetchTreatmentPlans, type TreatmentPlanView } from "@/lib/data/client";
import type { TreatmentPlan, TreatmentStep } from "@/lib/types/dental";

export default function DoctorTreatmentPlansPage() {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchTreatmentPlans(user.clinic_id, user.id);
    setPlans(data.map(p => ({
      ...p,
      steps: p.steps.map((s, i) => ({ ...s, step: i + 1 })),
    })) as unknown as TreatmentPlan[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading treatment plans...</p>
      </div>
    );
  }

  const handleUpdateStep = (planId: string, stepIndex: number, status: TreatmentStep["status"]) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const steps = [...p.steps];
        steps[stepIndex] = {
          ...steps[stepIndex],
          status,
          date: status === "completed" || status === "in_progress"
            ? new Date().toISOString().split("T")[0]
            : steps[stepIndex].date,
        };
        return { ...p, steps, updatedAt: new Date().toISOString().split("T")[0] };
      })
    );
  };

  const handleAddStep = (planId: string, description: string, cost: number) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const newStep: TreatmentStep = {
          step: p.steps.length + 1,
          description,
          status: "pending",
          date: null,
          cost,
        };
        return {
          ...p,
          steps: [...p.steps, newStep],
          totalCost: p.totalCost + cost,
          updatedAt: new Date().toISOString().split("T")[0],
        };
      })
    );
  };

  const handleDeleteStep = (planId: string, stepIndex: number) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const removedCost = p.steps[stepIndex].cost;
        const steps = p.steps.filter((_, i) => i !== stepIndex).map((s, i) => ({ ...s, step: i + 1 }));
        return { ...p, steps, totalCost: p.totalCost - removedCost, updatedAt: new Date().toISOString().split("T")[0] };
      })
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Treatment Plans</h1>
      <TreatmentPlanBuilder
        plans={plans}
        editable
        onUpdateStep={handleUpdateStep}
        onAddStep={handleAddStep}
        onDeleteStep={handleDeleteStep}
      />
    </div>
  );
}
