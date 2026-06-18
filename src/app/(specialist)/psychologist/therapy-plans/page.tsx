"use client";

import { Target } from "lucide-react";
import { useState, useEffect } from "react";
import { TherapyPlanView } from "@/components/para-medical/therapy-plan-view";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchTherapyPlans,
  updateTherapyPlanGoalStatus,
  toggleTherapyPlanMilestone,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { TherapyGoal, TherapyPlan } from "@/lib/types/para-medical";

export default function TherapyPlansPage() {
  const { addToast } = useToast();
  const [plans, setPlans] = useState<TherapyPlan[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      setClinicId(user.clinic_id);
      const data = await fetchTherapyPlans(user.clinic_id);
      if (controller.signal.aborted) return;
      setPlans(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        logger.warn("Failed to load therapy plans", {
          context: "psychologist/therapy-plans",
          error: err,
        });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function handleUpdateGoalStatus(
    planId: string,
    goalId: string,
    status: TherapyGoal["status"],
  ) {
    if (!clinicId) return;
    try {
      const updatedGoals = await updateTherapyPlanGoalStatus(clinicId, planId, goalId, status);
      setPlans((current: TherapyPlan[]) =>
        current.map((plan: TherapyPlan) =>
          plan.id === planId ? { ...plan, goals: updatedGoals } : plan,
        ),
      );
    } catch (err) {
      logger.warn("Failed to update goal status", {
        context: "psychologist/therapy-plans",
        error: err,
      });
      addToast("Failed to update goal", "error");
    }
  }

  async function handleToggleMilestone(planId: string, goalId: string, milestoneIndex: number) {
    if (!clinicId) return;
    try {
      const updatedGoals = await toggleTherapyPlanMilestone(
        clinicId,
        planId,
        goalId,
        milestoneIndex,
      );
      setPlans((current: TherapyPlan[]) =>
        current.map((plan: TherapyPlan) =>
          plan.id === planId ? { ...plan, goals: updatedGoals } : plan,
        ),
      );
    } catch (err) {
      logger.warn("Failed to toggle milestone", {
        context: "psychologist/therapy-plans",
        error: err,
      });
      addToast("Failed to update milestone", "error");
    }
  }

  if (loading) return <PageLoader message="Loading therapy plans..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load therapy plans.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Target className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-bold">Therapy Plans</h1>
      </div>
      <TherapyPlanView
        plans={plans}
        editable
        onUpdateGoalStatus={handleUpdateGoalStatus}
        onToggleMilestone={handleToggleMilestone}
      />
    </div>
  );
}
