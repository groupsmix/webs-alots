import { requireAuth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data/server";
import { AdminDashboardView } from "@/components/admin/admin-dashboard-view";

export default async function AdminDashboardPage() {
  const profile = await requireAuth();
  const stats = await getDashboardStats(profile.clinic_id!);
  return <AdminDashboardView stats={stats} />;
}
