import { fetchServices } from "@/lib/data/services";
import { requireTenant } from "@/lib/tenant";
import ServicesClient from "./_services-client";

export default async function ManageServicesPage() {
  const tenant = await requireTenant();
  const services = await fetchServices(tenant.clinicId);

  return <ServicesClient initialServices={services} />;
}
