"use client";

import { useState, useEffect, useCallback } from "react";
import { TreatmentPlanBuilder } from "@/components/dental/treatment-plan-builder";
import { getCurrentUser, fetchTreatmentPlans, updateTreatmentPlan } from "@/lib/data/client";
import type { TreatmentPlan, TreatmentStep } from "@/lib/types/dental";
import { PageLoader } from "@/components/ui/page-loader";

export default function DoctorTreatmentPlansPage() {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchTreatmentPlans(user.clinic_id, user.id);
    setPlans(data.map(p => ({
      ...p,
      steps: p.steps.map((s, i) => ({ ...s, step: i + 1 })),
    })) as unknown as TreatmentPlan[]);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return <PageLoader message="Loading treatment plans..." />;
  }

  const handleUpdateStep = async (planId: string, stepIndex: number, status: TreatmentStep["status"]) => {
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

    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      const updatedSteps = [...plan.steps];
      updatedSteps[stepIndex] = {
        ...updatedSteps[stepIndex],
        status,
        date: status === "completed" || status === "in_progress"
          ? new Date().toISOString().split("T")[0]
          : updatedSteps[stepIndex].date,
      };
      await updateTreatmentPlan(planId, {
        steps: updatedSteps.map((s) => ({
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
