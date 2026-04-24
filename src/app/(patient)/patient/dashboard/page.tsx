import { PatientDashboardView } from "@/components/patient/patient-dashboard-view";
import { requireAuth } from "@/lib/auth";
import { getPatientDashboardData } from "@/lib/data/server";

export default async function PatientDashboardPage() {
  const profile = await requireAuth();
  const data = await getPatientDashboardData(profile.clinic_id!, profile.id, profile.name);
  return <PatientDashboardView data={data} />;
}
