"use client";

import { useState, useEffect } from "react";
import { TreatmentPlanBuilder } from "@/components/dental/treatment-plan-builder";
import { getCurrentUser, fetchTreatmentPlans, updateTreatmentPlan } from "@/lib/data/client";
import type { TreatmentPlan, TreatmentStep } from "@/lib/types/dental";
import { PageLoader } from "@/components/ui/page-loader";

export default function DoctorTreatmentPlansPage() {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchTreatmentPlans(user.clinic_id, user.id);
      if (controller.signal.aborted) return;
    setPlans(data.map(p => ({
      ...p,
      steps: p.steps.map((s, i) => ({ ...s, step: i + 1 })),
    })) as TreatmentPlan[]);
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
    return <PageLoader message="Loading treatment plans..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const handleUpdateStep = async (planId: string, stepIndex: number, status: TreatmentStep["status"]) => {
    let updatedSteps: TreatmentStep[] | null = null;

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
        updatedSteps = steps;
        return { ...p, steps, updatedAt: new Date().toISOString().split("T")[0] };
      })
    );

    if (updatedSteps) {
      await updateTreatmentPlan(planId, {
        steps: (updatedSteps as TreatmentStep[]).map((s) => ({
          step: s.step,
          description: s.description,
          status: s.status,
          date: s.date,
          cost: s.cost,
          toothNumbers: s.toothNumbers,
        })),
      });
    }
  };

  const handleAddStep = async (planId: string, description: string, cost: number) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const newStep: TreatmentStep = {
      step: plan.steps.length + 1,
      description,
      status: "pending",
      date: null,
      cost,
    };
    const allSteps = [...plan.steps, newStep];

    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        return {
          ...p,
          steps: allSteps,
          totalCost: p.totalCost + cost,
          updatedAt: new Date().toISOString().split("T")[0],
        };
      })
    );

    await updateTreatmentPlan(planId, {
      steps: allSteps.map((s) => ({
        step: s.step,
        description: s.description,
        status: s.status,
        date: s.date,
        cost: s.cost,
        toothNumbers: s.toothNumbers,
      })),
      total_cost: plan.totalCost + cost,
    });
  };

  const handleDeleteStep = async (planId: string, stepIndex: number) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const removedCost = plan.steps[stepIndex].cost;
    const remainingSteps = plan.steps.filter((_, i) => i !== stepIndex).map((s, i) => ({ ...s, step: i + 1 }));

    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        return { ...p, steps: remainingSteps, totalCost: p.totalCost - removedCost, updatedAt: new Date().toISOString().split("T")[0] };
      })
    );

    await updateTreatmentPlan(planId, {
      steps: remainingSteps.map((s) => ({
        step: s.step,
        description: s.description,
        status: s.status,
        date: s.date,
        cost: s.cost,
        toothNumbers: s.toothNumbers,
      })),
      total_cost: plan.totalCost - removedCost,
    });
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
