"use client";

import { useState, useEffect } from "react";
import { TreatmentPlanBuilder } from "@/components/dental/treatment-plan-builder";
import {
  getCurrentUser,
  fetchTreatmentPlans,
  type TreatmentPlanView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function PatientTreatmentPlanPage() {
  const [myPlans, setMyPlans] = useState<TreatmentPlanView[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const plans = await fetchTreatmentPlans(user.clinic_id);
      if (controller.signal.aborted) return;
    setMyPlans(plans.filter(p => p.patientId === user.id));
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
