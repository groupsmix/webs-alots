import { ReceptionistDashboardView } from "@/components/receptionist/receptionist-dashboard-view";
import { requireAuth } from "@/lib/auth";
import { getReceptionistDashboardData } from "@/lib/data/dashboard";

/**
 * PERF-LAT-07: Server Component entry point for the receptionist dashboard.
 *
 * Previously this page was entirely client-side: it shipped a spinner,
 * hydrated, then ran getCurrentUser() (a browser→Supabase auth round trip)
 * followed by three data fetches — every visit paid a full client-side
 * waterfall before anything useful rendered. Data is now fetched during the
 * server render (one parallel query batch; see getReceptionistDashboardData)
 * and streamed with the HTML, with the route group's loading.tsx skeleton
 * as the streaming fallback. Role access is enforced by middleware
 * (ROLE_ROUTE_MAP) and requireAuth.
 */
export default async function ReceptionistDashboardPage() {
  const profile = await requireAuth();

  // Mirror the legacy behavior for a receptionist with no clinic assigned:
  // render the dashboard shell with empty data instead of erroring.
  if (!profile.clinic_id) {
    return (
      <ReceptionistDashboardView
        clinicId=""
        initialAppointments={[]}
        patients={[]}
        totalRevenue={0}
      />
    );
  }

  const data = await getReceptionistDashboardData(profile.clinic_id);
  return (
    <ReceptionistDashboardView
      clinicId={profile.clinic_id}
      initialAppointments={data.appointments}
      patients={data.patients}
      totalRevenue={data.totalRevenue}
    />
  );
}
