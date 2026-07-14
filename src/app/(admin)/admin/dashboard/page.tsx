import { AdminDashboardView } from "@/components/admin/admin-dashboard-view";
import { requireAuth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data/dashboard";
import { getLocalDateStr } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const profile = await requireAuth();
  const stats = await getDashboardStats(profile.clinic_id!);
  return <AdminDashboardView stats={stats} ownerName={profile.name} today={getLocalDateStr()} />;
}
