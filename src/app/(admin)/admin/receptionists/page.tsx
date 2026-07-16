import { fetchReceptionists } from "@/lib/data/receptionists";
import { requireTenant } from "@/lib/tenant";
import ReceptionistsClient from "./_receptionists-client";

export default async function ManageReceptionistsPage() {
  const tenant = await requireTenant();
  const receptionists = await fetchReceptionists(tenant.clinicId);

  return <ReceptionistsClient initialReceptionists={receptionists} />;
}
