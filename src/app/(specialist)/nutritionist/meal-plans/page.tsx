"use client";

import { Apple } from "lucide-react";
import { useState, useEffect } from "react";
import { MealPlanBuilder } from "@/components/para-medical/meal-plan-builder";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchMealPlans,
  addMealPlanItem,
  removeMealPlanItem,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { MealItem, MealPlan } from "@/lib/types/para-medical";

type MealSlot = "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner";

export default function MealPlansPage() {
  const { addToast } = useToast();
  const [plans, setPlans] = useState<MealPlan[]>([]);
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
      const data = await fetchMealPlans(user.clinic_id);
      if (controller.signal.aborted) return;
      setPlans(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        logger.warn("Failed to load meal plans", {
          context: "nutritionist/meal-plans",
          error: err,
        });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function handleAddMealItem(planId: string, dayIndex: number, slot: string, item: MealItem) {
    if (!clinicId) return;
    try {
      const updatedDays = await addMealPlanItem(clinicId, planId, dayIndex, slot as MealSlot, item);
      setPlans((current: MealPlan[]) =>
        current.map((plan: MealPlan) =>
          plan.id === planId ? { ...plan, daily_plans: updatedDays } : plan,
        ),
      );
    } catch (err) {
      logger.warn("Failed to add meal item", { context: "nutritionist/meal-plans", error: err });
      addToast("Failed to add item", "error");
    }
  }

  async function handleRemoveMealItem(
    planId: string,
    dayIndex: number,
    slot: string,
    itemIndex: number,
  ) {
    if (!clinicId) return;
    try {
      const updatedDays = await removeMealPlanItem(
        clinicId,
        planId,
        dayIndex,
        slot as MealSlot,
        itemIndex,
      );
      setPlans((current: MealPlan[]) =>
        current.map((plan: MealPlan) =>
          plan.id === planId ? { ...plan, daily_plans: updatedDays } : plan,
        ),
      );
    } catch (err) {
      logger.warn("Failed to remove meal item", { context: "nutritionist/meal-plans", error: err });
      addToast("Failed to remove item", "error");
    }
  }

  if (loading) return <PageLoader message="Loading meal plans..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load meal plans.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Apple className="h-6 w-6 text-green-600" />
        <h1 className="text-2xl font-bold">Meal Plans</h1>
      </div>
      <MealPlanBuilder
        plans={plans}
        editable
        onAddMealItem={handleAddMealItem}
        onRemoveMealItem={handleRemoveMealItem}
      />
    </div>
  );
}
