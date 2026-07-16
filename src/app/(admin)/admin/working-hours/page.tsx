import { fetchWorkingHoursData } from "@/lib/data/working-hours";
import { requireTenant } from "@/lib/tenant";
import WorkingHoursClient from "./_working-hours-client";

export default async function WorkingHoursPage() {
  const tenant = await requireTenant();
  const { doctors, doctorSchedules } = await fetchWorkingHoursData(tenant.clinicId);

  return <WorkingHoursClient doctors={doctors} doctorSchedules={doctorSchedules} />;
}
