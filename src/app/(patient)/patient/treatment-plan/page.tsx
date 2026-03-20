import { TreatmentPlanBuilder } from "@/components/dental/treatment-plan-builder";
import { treatmentPlans } from "@/lib/dental-demo-data";

export default function PatientTreatmentPlanPage() {
  // Filter to show only plans for the current patient (demo: p1)
  const myPlans = treatmentPlans.filter((p) => p.patientId === "p1");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Treatment Plan</h1>
      {myPlans.length === 0 ? (
        <p className="text-muted-foreground">No treatment plans found.</p>
      ) : (
        <TreatmentPlanBuilder plans={myPlans} editable={false} />
      )}
    </div>
  );
}
