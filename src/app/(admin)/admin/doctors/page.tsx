import { fetchDoctors } from "@/lib/data/doctors";
import { requireTenant } from "@/lib/tenant";
import DoctorsClient from "./_doctors-client";

export default async function ManageDoctorsPage() {
  const tenant = await requireTenant();
  const doctors = await fetchDoctors(tenant.clinicId);

  return <DoctorsClient initialDoctors={doctors} />;
}
