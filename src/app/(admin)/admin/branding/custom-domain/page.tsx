import { fetchCustomDomains } from "@/lib/data/custom-domains";
import { requireTenant } from "@/lib/tenant";
import CustomDomainsClient from "./_custom-domains-client";

export default async function CustomDomainPage() {
  const tenant = await requireTenant();
  const domains = await fetchCustomDomains(tenant.clinicId);

  return <CustomDomainsClient clinicId={tenant.clinicId} initialDomains={domains} />;
}
