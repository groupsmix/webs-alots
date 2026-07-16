import { fetchRevenuePerDoctor } from "@/lib/data/revenue-per-doctor";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";
import RevenuePerDoctorClient from "./_revenue-per-doctor-client";

export default async function RevenuePerDoctorPage() {
  const tenant = await requireTenant();
  const data = await fetchRevenuePerDoctor(tenant.clinicId, "30d");
  const locale = getLocaleFromTenant(tenant);

  return <RevenuePerDoctorClient clinicId={tenant.clinicId} locale={locale} initialData={data} />;
}
