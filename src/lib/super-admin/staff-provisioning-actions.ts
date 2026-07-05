import { sendEmail } from "@/lib/email";
import { staffWelcomeEmail } from "@/lib/email-templates";
import { getSiteUrl, getSupabaseServiceRoleKey } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";
import type { SuperAdminClient } from "@/lib/super-admin/base";
import type {
  CreateUserAccess,
  CreateUserInput,
  CreateUserResult,
  UserRow,
} from "@/lib/super-admin/models";

async function fetchClinicName(supabase: SuperAdminClient, clinicId: string): Promise<string> {
  const { data } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .maybeSingle();
  const name = data?.name?.trim();
  return name && name.length > 0 ? name : "your clinic";
}

async function persistStaffUserRow(
  supabase: SuperAdminClient,
  input: CreateUserInput,
  authId: string | null,
): Promise<UserRow> {
  if (authId) {
    const { data: existingRow } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    if (existingRow) {
      const { data: updated, error: updateError } = await supabase
        .from("users")
        .update({
          clinic_id: input.clinic_id,
          role: input.role,
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
        })
        .eq("auth_id", authId)
        .select()
        .single();

      if (updateError) throw new Error(`Failed to update user: ${updateError.message}`);
      return updated as UserRow;
    }
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      clinic_id: input.clinic_id,
      role: input.role,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      ...(authId ? { auth_id: authId } : {}),
    })
    .select()
    .single();

  if (!error) return data as UserRow;

  const isDuplicate =
    error.code === "23505" || /duplicate key|already exists|unique constraint/i.test(error.message);
  if (isDuplicate && input.email) {
    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({
        clinic_id: input.clinic_id,
        role: input.role,
        name: input.name,
        phone: input.phone ?? null,
        ...(authId ? { auth_id: authId } : {}),
      })
      .eq("email", input.email)
      .select()
      .single();

    if (!updateError && updated) return updated as UserRow;
  }

  throw new Error(`Failed to create user: ${error.message}`);
}

async function sendStaffInvite(params: {
  email: string;
  name: string;
  role: string;
  clinicName: string;
}): Promise<{ inviteSent: boolean; inviteError?: string }> {
  try {
    const siteUrl = getSiteUrl() || "https://oltigo.com";
    const admin = createAdminClient("super_admin");
    const { data: resetLink, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: params.email,
      options: { redirectTo: `${siteUrl}/login?reset=true` },
    });

    if (linkError) {
      logger.warn("Failed to generate staff invite link", {
        context: "super-admin-actions",
        email: params.email,
        error: linkError.message,
      });
      return { inviteSent: false, inviteError: linkError.message };
    }

    const loginUrl = resetLink?.properties?.action_link ?? `${siteUrl}/login`;
    const template = staffWelcomeEmail({
      staffName: params.name,
      clinicName: params.clinicName,
      email: params.email,
      loginUrl,
      role: params.role,
    });
    const result = await sendEmail({ to: params.email, ...template });

    if (!result.success) {
      logger.warn("Staff invite email not sent", {
        context: "super-admin-actions",
        email: params.email,
        error: result.error,
      });
    }

    return { inviteSent: result.success, inviteError: result.success ? undefined : result.error };
  } catch (err) {
    const message = err instanceof Error ? err.message : "invite send failed";
    logger.warn("Failed to send welcome email to staff", {
      context: "super-admin-actions",
      email: params.email,
      error: err,
    });
    return { inviteSent: false, inviteError: message };
  }
}

export async function createUserImpl(
  supabase: SuperAdminClient,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  let authId: string | null = null;
  let authError: string | undefined;
  const serviceRoleConfigured = Boolean(getSupabaseServiceRoleKey());

  if (input.email && serviceRoleConfigured) {
    try {
      const admin = createAdminClient("super_admin");
      const secureOneTimePassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 8);
      const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
        email: input.email,
        password: secureOneTimePassword,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          role: input.role,
          clinic_id: input.clinic_id,
          must_change_password: true,
        },
      });

      if (createErr) {
        if (createErr.message?.includes("already been registered")) {
          const { data: listData } = await admin.auth.admin.listUsers();
          const existing = listData?.users?.find((user) => user.email === input.email);
          if (existing) {
            authId = existing.id;
          } else {
            authError = createErr.message;
          }
        } else {
          authError = createErr.message;
          logger.warn("Failed to create auth account for staff — user created without login", {
            context: "super-admin-actions",
            email: input.email,
            error: createErr.message,
          });
        }
      } else if (authUser?.user) {
        authId = authUser.user.id;
      }
    } catch (err) {
      authError = err instanceof Error ? err.message : "auth account creation failed";
      logger.warn("Auth account creation threw — user will be created without login", {
        context: "super-admin-actions",
        email: input.email,
        error: err,
      });
    }
  }

  const userRow = await persistStaffUserRow(supabase, input, authId);

  let access: CreateUserAccess;
  if (!input.email) {
    access = {
      authCreated: false,
      inviteSent: false,
      inviteError: "No email provided — this staff member cannot log in.",
    };
  } else if (!authId) {
    access = {
      authCreated: false,
      inviteSent: false,
      inviteError: serviceRoleConfigured
        ? (authError ?? "Login could not be enabled for this staff member.")
        : "Login not enabled — requires SUPABASE_SERVICE_ROLE_KEY and an email provider.",
    };
  } else {
    const clinicName = await fetchClinicName(supabase, input.clinic_id);
    const invite = await sendStaffInvite({
      email: input.email,
      name: input.name,
      role: input.role,
      clinicName,
    });
    access = {
      authCreated: true,
      inviteSent: invite.inviteSent,
      inviteError: invite.inviteError,
    };
  }

  return { ...userRow, access };
}
