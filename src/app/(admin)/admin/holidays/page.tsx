import { fetchHolidays } from "@/lib/data/holidays";
import { requireTenant } from "@/lib/tenant";
import HolidaysClient from "./_holidays-client";

export default async function AdminHolidaysPage() {
  const tenant = await requireTenant();
  const holidays = await fetchHolidays(tenant.clinicId);

  return <HolidaysClient clinicId={tenant.clinicId} initialHolidays={holidays} />;
}
