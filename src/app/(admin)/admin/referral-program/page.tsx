import { requireAuth } from "@/lib/auth";
import { fetchReferralProgram } from "@/lib/data/referral-program";
import { requireTenant } from "@/lib/tenant";
import ReferralProgramClient from "./_referral-program-client";

export default async function ReferralProgramPage() {
  const tenant = await requireTenant();
  const profile = await requireAuth();
  const data = await fetchReferralProgram(tenant.clinicId, profile.id);

  return <ReferralProgramClient initialData={data} />;
}
