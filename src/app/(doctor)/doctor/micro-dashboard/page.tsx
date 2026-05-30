import { MicroDashboardView } from "@/components/doctor/micro-dashboard-view";
import { requireRole } from "@/lib/auth";

export default async function MicroDashboardPage() {
  await requireRole("doctor", "clinic_admin");
  return <MicroDashboardView />;
}
