"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

export interface ClinicUserRow {
  id: string;
  auth_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  clinic_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClinicServiceRow {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
  currency: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Authenticate the caller as a clinic admin and resolve their clinic id +
 * session-scoped Supabase client. Throws if the user has no clinic context
 * (e.g. a super_admin with `clinic_id = null` hitting a clinic-only action).
 */
export async function adminContext() {
  const profile = await requireRole("clinic_admin", "super_admin");
  if (!profile.clinic_id) {
    throw new Error("No clinic context for the current user");
  }
  const supabase = await createClient();
  return { profile, clinicId: profile.clinic_id, supabase };
}
