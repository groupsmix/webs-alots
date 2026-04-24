import { AdminDashboardView } from "@/components/admin/admin-dashboard-view";
import { requireAuth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data/server";

export default async function AdminDashboardPage() {
  const profile = await requireAuth();
  const stats = await getDashboardStats(profile.clinic_id!);
  return <AdminDashboardView stats={stats} />;
}
