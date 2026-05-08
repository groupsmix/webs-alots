import { DoctorDashboardView } from "@/components/doctor/doctor-dashboard-view";
import { requireAuth } from "@/lib/auth";
import { getDoctorDashboardData } from "@/lib/data/server";

export default async function DoctorDashboardPage() {
  const profile = await requireAuth();
  const data = await getDoctorDashboardData(profile.clinic_id!, profile.id);
  return (
    <DoctorDashboardView
      initialAppointments={data.appointments}
      patients={data.patients}
      waitingRoom={data.waitingRoom}
      invoices={data.invoices}
    />
  );
}
