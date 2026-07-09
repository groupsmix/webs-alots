"use server";

import { sendEmail } from "@/lib/email";
import { staffWelcomeEmail } from "@/lib/email-templates";
import { getSiteUrl, getSupabaseServiceRoleKey } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createScopedAdminClient } from "@/lib/supabase-server";
import type { Json, TablesInsert, TablesUpdate } from "@/lib/types/database";
import { adminContext, type ClinicUserRow } from "./base";

export type ClinicStaffRole = "doctor" | "receptionist";

export interface CreateClinicUserInput {
  role: ClinicStaffRole;
  name: string;
  email?: string;
  phone?: string;
  /** Role-specific extras (e.g. doctor specialty, consultation_fee, languages). */
  metadata?: Record<string, unknown>;
}

export async function createClinicUser(input: CreateClinicUserInput): Promise<ClinicUserRow> {
  const { clinicId, supabase } = await adminContext();

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const role = input.role;

  let authId: string | null = null;

  // 1. Best-effort Supabase Auth account so the staff member can log in.
  if (email && getSupabaseServiceRoleKey()) {
    try {
      const admin = createScopedAdminClient("register_clinic", clinicId);
      const tempPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 8);
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name, role, clinic_id: clinicId, must_change_password: true },
      });

      if (authError) {
        if (authError.message?.includes("already been registered")) {
          const { data: listData } = await admin.auth.admin.listUsers();
          const existing = listData?.users?.find(
            (u: { email?: string | null; id: string }) => u.email === email,
          );
          if (existing) authId = existing.id;
        } else {
          logger.warn("Failed to create auth account for staff — creating without login", {
            context: "admin-actions",
            role,
            error: authError.message,
          });
        }
      } else if (authUser?.user) {
        authId = authUser.user.id;
      }
    } catch (err) {
      logger.warn("Auth account creation threw — creating staff without login", {
        context: "admin-actions",
        error: err,
      });
    }
  }

  // 2. The users.auth_id column is UNIQUE — never link an auth_id that another
  //    profile already owns, otherwise the insert fails with a duplicate key.
  if (authId) {
    const { data: existingRow } = await supabase
      .from("users") // nosemgrep: semgrep.tenant-scoping — intentional cross-tenant auth_id uniqueness check; users.auth_id is a global Supabase Auth identity, not clinic-scoped
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();
    if (existingRow) {
      logger.warn("auth_id already linked to a users row — creating staff without auth link", {
        context: "admin-actions",
        authId,
      });
      authId = null;
    }
  }

  const insertPayload: Record<string, unknown> = {
    clinic_id: clinicId,
    role,
    name,
    email,
    phone,
    metadata: (input.metadata ?? {}) as Json,
    is_active: true,
    ...(authId ? { auth_id: authId } : {}),
  };

  const { data, error } = await supabase
    .from("users") // nosemgrep: semgrep.tenant-scoping — clinic_id is inside insertPayload (derived from authenticated profile); INSERT has no .eq() chain by design
    .insert(insertPayload as TablesInsert<"users">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create ${role}: ${error.message}`);

  // 3. Best-effort welcome email with a password-setup link.
  if (email && authId) {
    try {
      const siteUrl = getSiteUrl() || "https://oltigo.com";
      const admin = createScopedAdminClient("register_clinic", clinicId);
      const { data: resetLink } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${siteUrl}/login?reset=true` },
      });
      const loginUrl = resetLink?.properties?.action_link ?? `${siteUrl}/login`;
      const template = staffWelcomeEmail({
        staffName: name,
        clinicName: clinicId,
        email,
        loginUrl,
        role,
      });
      await sendEmail({ to: email, ...template });
    } catch (emailErr) {
      logger.warn("Failed to send staff welcome email", {
        context: "admin-actions",
        error: emailErr,
      });
    }
  }

  return data as unknown as ClinicUserRow;
}

export interface UpdateClinicUserInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  /** Shallow-merged into the existing metadata so untouched keys survive. */
  metadata?: Record<string, unknown>;
}

export async function updateClinicUser(
  userId: string,
  patch: UpdateClinicUserInput,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.email !== undefined) update.email = patch.email?.toString().trim() || null;
  if (patch.phone !== undefined) update.phone = patch.phone?.toString().trim() || null;

  if (patch.metadata !== undefined) {
    const { data: existing } = await supabase
      .from("users")
      .select("metadata")
      .eq("id", userId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    const current = ((existing as { metadata?: Record<string, unknown> } | null)?.metadata ??
      {}) as Record<string, unknown>;
    update.metadata = { ...current, ...patch.metadata } as Json;
  }

  const { error } = await supabase
    .from("users")
    .update(update as TablesUpdate<"users">)
    .eq("id", userId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update user: ${error.message}`);
}

export async function setClinicUserActive(userId: string, isActive: boolean): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("users")
    .update({ is_active: isActive } as TablesUpdate<"users">)
    .eq("id", userId)
    .eq("clinic_id", clinicId);
  if (error) throw new Error(`Failed to update user status: ${error.message}`);
}

export async function deleteClinicUser(userId: string): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .eq("clinic_id", clinicId);
  if (error) throw new Error(`Failed to delete user: ${error.message}`);
}
