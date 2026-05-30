import { DrugInteractionChecker } from "@/components/doctor/drug-interaction-checker";
import { requireRole } from "@/lib/auth";

export default async function DrugInteractionsPage() {
  await requireRole("doctor", "clinic_admin");
  return (
    <div className="mx-auto max-w-3xl p-4">
      <DrugInteractionChecker />
    </div>
  );
}
