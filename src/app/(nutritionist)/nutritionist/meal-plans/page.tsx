"use client";

import { useState, useEffect } from "react";
import { Apple } from "lucide-react";
import { MealPlanBuilder } from "@/components/para-medical/meal-plan-builder";
import { getCurrentUser } from "@/lib/data/client";
import type { MealPlan } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

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
    return <PageLoader message="Loading meal plans..." />;
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
