import { AdminDashboardView } from "@/components/admin/admin-dashboard-view";
import { requireAuth } from "@/lib/auth";
import { getOwnerDashboardDailyData } from "@/lib/data/admin-owner-dashboard";
import { getDashboardStats } from "@/lib/data/dashboard";
import { requireTenantWithConfig } from "@/lib/tenant";
import { getLocalDateStr } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const [profile, { tenant, config }] = await Promise.all([
    requireAuth(),
    requireTenantWithConfig(),
  ]);
  const today = getLocalDateStr(new Date(), config.timezone);
  const [stats, dailyData] = await Promise.all([
    getDashboardStats(tenant.clinicId),
    getOwnerDashboardDailyData(tenant.clinicId, today, config.timezone),
  ]);

  return (
    <AdminDashboardView
      stats={stats}
      ownerName={profile.name}
      today={today}
      todaySummary={dailyData.today}
      briefing={dailyData.briefing}
    />
  );
}
