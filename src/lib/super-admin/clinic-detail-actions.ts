import type { SuperAdminClient } from "@/lib/super-admin/base";
import { mapActivityLog } from "@/lib/super-admin/helpers";
import type { ClinicFeatureOverride } from "@/lib/super-admin/models";
import type { ActivityLog } from "@/lib/super-admin/types";

export async function fetchClinicFeatureOverridesImpl(
  supabase: SuperAdminClient,
  clinicId: string,
): Promise<ClinicFeatureOverride[]> {
  const { data, error } = await supabase
    .from("clinic_feature_overrides")
    .select("id, clinic_id, feature_key, enabled, created_at")
    .eq("clinic_id", clinicId);

  if (error || !data) return [];
  return data as ClinicFeatureOverride[];
}

export async function upsertClinicFeatureOverrideImpl(
  supabase: SuperAdminClient,
  clinicId: string,
  featureId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("clinic_feature_overrides")
    .upsert(
      { clinic_id: clinicId, feature_key: featureId, enabled },
      { onConflict: "clinic_id,feature_key" },
    );

  if (error) throw new Error(`Failed to upsert feature override: ${error.message}`);
}

export async function deleteClinicFeatureOverrideImpl(
  supabase: SuperAdminClient,
  clinicId: string,
  featureId: string,
): Promise<void> {
  const { error } = await supabase
    .from("clinic_feature_overrides")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("feature_key", featureId);

  if (error) throw new Error(`Failed to delete feature override: ${error.message}`);
}

export async function fetchClinicStaffCountImpl(
  supabase: SuperAdminClient,
  clinicId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .in("role", ["clinic_admin", "receptionist", "doctor"]);

  if (error) return 0;
  return count ?? 0;
}

export async function fetchClinicPatientCountImpl(
  supabase: SuperAdminClient,
  clinicId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("role", "patient");

  if (error) return 0;
  return count ?? 0;
}

export async function fetchClinicActivityLogsImpl(
  supabase: SuperAdminClient,
  clinicId: string,
): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, description, clinic_id, clinic_name, created_at, actor, type")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data.map(mapActivityLog);
}
