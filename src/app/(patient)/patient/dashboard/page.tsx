import { requireAuth } from "@/lib/auth";
import { getPatientDashboardData } from "@/lib/data/server";
import { PatientDashboardView } from "@/components/patient/patient-dashboard-view";

export default async function PatientDashboardPage() {
  const profile = await requireAuth();
  const data = await getPatientDashboardData(profile.clinic_id!, profile.id, profile.name);
  return <PatientDashboardView data={data} />;
}
