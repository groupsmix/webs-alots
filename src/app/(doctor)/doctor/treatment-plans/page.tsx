"use client";

import { useState } from "react";
import { TreatmentPlanBuilder } from "@/components/dental/treatment-plan-builder";
import { treatmentPlans as initialPlans, type TreatmentPlan, type TreatmentStep } from "@/lib/dental-demo-data";

export default function DoctorTreatmentPlansPage() {
  const [plans, setPlans] = useState<TreatmentPlan[]>(initialPlans);

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
