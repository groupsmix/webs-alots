"use client";

import { useState, useEffect, useCallback } from "react";
import { TreatmentPlanBuilder } from "@/components/dental/treatment-plan-builder";
import {
  getCurrentUser,
  fetchTreatmentPlans,
  type TreatmentPlanView,
} from "@/lib/data/client";

export default function PatientTreatmentPlanPage() {
  const [myPlans, setMyPlans] = useState<TreatmentPlanView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const plans = await fetchTreatmentPlans(user.clinic_id);
    setMyPlans(plans.filter(p => p.patientId === user.id));
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Treatment Plan</h1>
      {myPlans.length === 0 ? (
        <p className="text-muted-foreground">No treatment plans found.</p>
      ) : (
        <TreatmentPlanBuilder plans={myPlans.map(p => ({ ...p, steps: p.steps.map((s, i) => ({ ...s, step: i + 1 })) }))} editable={false} />
      )}
    </div>
  );
}
