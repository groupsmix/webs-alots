import { WellbeingMonitor } from "@/components/doctor/wellbeing-monitor";
import { requireRole } from "@/lib/auth";

export default async function WellbeingPage() {
  await requireRole("doctor", "clinic_admin");
  return (
    <div className="mx-auto max-w-3xl p-4">
      <WellbeingMonitor />
    </div>
  );
}
