import type { SectionVisibility } from "@/lib/section-visibility";
import { createTenantClient } from "@/lib/supabase-server";

export async function fetchSectionVisibility(clinicId: string): Promise<SectionVisibility | null> {
  const supabase = await createTenantClient(clinicId);

  const { data, error } = await supabase
    .from("clinics")
    .select("section_visibility")
    .eq("id", clinicId)
    .single();

  if (error || !data?.section_visibility) {
    return null;
  }

  return data.section_visibility as unknown as SectionVisibility;
}
