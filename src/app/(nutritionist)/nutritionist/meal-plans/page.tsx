"use client";

import { useState, useEffect, useCallback } from "react";
import { Apple } from "lucide-react";
import { MealPlanBuilder } from "@/components/para-medical/meal-plan-builder";
import { getCurrentUser } from "@/lib/data/client";
import type { MealPlan } from "@/lib/types/para-medical";

export default function MealPlansPage() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    setPlans([]);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading meal plans...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Apple className="h-6 w-6 text-green-600" />
        <h1 className="text-2xl font-bold">Meal Plans</h1>
      </div>
      <MealPlanBuilder plans={plans} editable />
    </div>
  );
}
