import { LabPrereadView } from "@/components/doctor/lab-preread-view";
import { requireRole } from "@/lib/auth";

export default async function LabPrereadPage() {
  await requireRole("doctor", "clinic_admin");
  return (
    <div className="mx-auto max-w-3xl p-4">
      <LabPrereadView />
    </div>
  );
}
