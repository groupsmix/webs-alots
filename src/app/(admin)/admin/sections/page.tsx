import { fetchSectionVisibility } from "@/lib/data/branding";
import { mergeSectionVisibility } from "@/lib/section-visibility";
import { requireTenant } from "@/lib/tenant";
import SectionsForm from "./_sections-form";

export default async function SectionsPage() {
  const tenant = await requireTenant();
  const saved = await fetchSectionVisibility(tenant.clinicId);
  const initialVisibility = mergeSectionVisibility(saved);

  return <SectionsForm initialVisibility={initialVisibility} />;
}
