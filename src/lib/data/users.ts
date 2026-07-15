import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export async function fetchUserNameMap(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, string>();
  if (uniqueIds.length === 0) return map;

  const batchSize = 100;
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("users")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .in("id", batch);

    if (error) {
      throw new Error(`Failed to resolve user names: ${error.message}`);
    }

    (data ?? []).forEach((row) => {
      map.set(row.id, row.name);
    });
  }

  return map;
}
