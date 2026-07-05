import type { ClinicTier, ClinicType } from "@/lib/types/database";

// Row shapes returned by raw queries (match SQL schema, not the TS Database type)
export interface ClinicRow {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown> | null;
  tier: string | null;
  status: string | null;
  subdomain: string | null;
  created_at: string | null;
}

export interface UserRow {
  id: string;
  auth_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  clinic_id: string | null;
  created_at: string | null;
}

export interface ServiceRow {
  id: string;
  clinic_id: string;
  name: string;
  price: number | null;
  duration_minutes: number;
  category: string | null;
}

export interface TimeSlotRow {
  id: string;
  doctor_id: string;
  clinic_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  max_capacity: number;
  buffer_minutes: number;
}

export interface CreateClinicInput {
  name: string;
  type: ClinicType;
  tier: ClinicTier;
  config?: Record<string, unknown>;
  status?: "active" | "inactive" | "suspended";
  subdomain?: string;
}

export interface CreateUserInput {
  clinic_id: string;
  role: "clinic_admin" | "receptionist" | "doctor";
  name: string;
  phone?: string;
  email?: string;
}

/**
 * Per-staff access state returned by {@link createUser} so the onboarding
 * wizard can report the true login status instead of showing a fake shared
 * password that never matches the real random auth password.
 */
export interface CreateUserAccess {
  /** A Supabase Auth login exists (was created or already existed) for this staff member. */
  authCreated: boolean;
  /** The "set your password" invitation email was sent successfully. */
  inviteSent: boolean;
  /** Human-readable reason when a login or invite could not be provided. */
  inviteError?: string;
}

/** {@link createUser} result: the persisted row plus its real access state. */
export type CreateUserResult = UserRow & { access: CreateUserAccess };

export interface CreateServiceInput {
  clinic_id: string;
  name: string;
  price?: number;
  duration_minutes: number;
  category?: string;
}

export interface ClinicFeatureOverride {
  id: string;
  clinic_id: string;
  feature_key: string;
  enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}
