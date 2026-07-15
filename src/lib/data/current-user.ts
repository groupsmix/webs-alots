import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";

export interface CurrentUserProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
}

export async function getCurrentUserProfile(clinicId: string): Promise<CurrentUserProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("clinic_id", clinicId)
    .eq("auth_id", user.id)
    .single();

  if (error || !data) {
    throw new Error("Failed to load user profile");
  }

  return data as Tables<"users">;
}
