import { assertClinicId } from "@/lib/assert-tenant";
import { requireRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import {
  clinicActivatedEmail,
  clinicSuspendedEmail,
} from "@/lib/email-templates";
import { logger } from "@/lib/logger";
import { syncClinicOnboardingState } from "@/lib/onboarding/state";
import { assertAllowedSubdomain } from "@/lib/reserved-subdomains";
import { invalidateSubdomainCache } from "@/lib/subdomain-cache";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import type { SuperAdminClient } from "@/lib/super-admin/base";
import type {
  ClinicRow,
  CreateClinicInput,
} from "@/lib/super-admin/models";
import type { Json } from "@/lib/types/database";

export async function createClinicImpl(
  supabase: SuperAdminClient,
  input: CreateClinicInput,
): Promise<ClinicRow> {
  const cfg = input.config ?? {};

  if (input.subdomain) {
    assertAllowedSubdomain(input.subdomain);
  }

  const { data, error } = await supabase
    .from("clinics")
    .insert({
      name: input.name,
      type: input.type,
      tier: input.tier,
      status: input.status ?? "inactive",
      config: cfg as Json,
      subdomain: input.subdomain ?? null,
      phone: (cfg.phone as string) || null,
      address: (cfg.address as string) || null,
      owner_email: (cfg.email as string) || null,
      owner_name: (cfg.owner_name as string) || null,
      city: (cfg.city as string) || null,
      domain: (cfg.domain as string) || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create clinic: ${error.message}`);

  await syncClinicOnboardingState({
    supabase,
    clinicId: data.id,
    clinicName: input.name,
    contactName: typeof cfg.owner_name === "string" ? cfg.owner_name : null,
    contactPhone: typeof cfg.phone === "string" ? cfg.phone : null,
    contactEmail: typeof cfg.email === "string" ? cfg.email : null,
    completedSteps: ["clinic_info"],
    currentStep: "team_setup",
    status: "in_progress",
  });

  return data as ClinicRow;
}

export async function activateClinicImpl(
  supabase: SuperAdminClient,
  clinicId: string,
): Promise<void> {
  const { data: clinic, error: fetchError } = await supabase
    .from("clinics")
    .select("id, name, subdomain, status")
    .eq("id", clinicId)
    .single();

  if (fetchError) throw new Error(`Failed to load clinic for activation: ${fetchError.message}`);

  const { error } = await supabase.from("clinics").update({ status: "active" }).eq("id", clinicId);

  if (error) throw new Error(`Failed to activate clinic: ${error.message}`);

  if (clinic?.subdomain) {
    invalidateSubdomainCache(clinic.subdomain);
  }

  try {
    await supabase.from("activity_logs").insert({
      action: "clinic_activated",
      description: `Clinic "${clinic?.name ?? clinicId}" activated on onboarding completion`,
      clinic_id: clinicId,
      clinic_name: clinic?.name ?? null,
      type: "clinic",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", {
      context: "super-admin-actions",
      clinicId,
      error: err,
    });
  }
}

export async function fetchClinicsImpl(supabase: SuperAdminClient): Promise<ClinicRow[]> {
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, type, config, tier, status, subdomain, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch clinics: ${error.message}`);
  return (data ?? []) as ClinicRow[];
}

export async function fetchClinicByIdImpl(
  supabase: SuperAdminClient,
  clinicId: string,
): Promise<ClinicRow | null> {
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, type, config, tier, status, subdomain, created_at")
    .eq("id", clinicId)
    .single();

  if (error) return null;
  return data as ClinicRow;
}

export async function fetchClinicAdminUserIdImpl(
  supabase: SuperAdminClient,
  clinicId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("role", "clinic_admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function updateClinicStatusImpl(
  supabase: SuperAdminClient,
  clinicId: string,
  status: "active" | "inactive" | "suspended",
): Promise<void> {
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, subdomain, owner_email, owner_name")
    .eq("id", clinicId)
    .single();

  const { error } = await supabase.from("clinics").update({ status }).eq("id", clinicId);

  if (error) throw new Error(`Failed to update clinic status: ${error.message}`);

  if (clinic?.subdomain) {
    invalidateSubdomainCache(clinic.subdomain);
  }

  try {
    await supabase.from("activity_logs").insert({
      action: status === "suspended" ? "clinic_suspended" : "clinic_activated",
      description: `Clinic "${clinic?.name ?? clinicId}" status changed to ${status}`,
      clinic_id: clinicId,
      clinic_name: clinic?.name ?? null,
      type: "clinic",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", {
      context: "super-admin-actions",
      clinicId,
      error: err,
    });
  }

  if (clinic?.owner_email) {
    try {
      const template =
        status === "suspended"
          ? clinicSuspendedEmail({
              clinicName: clinic.name ?? "Your Clinic",
              adminName: clinic.owner_name ?? "Admin",
            })
          : clinicActivatedEmail({
              clinicName: clinic.name ?? "Your Clinic",
              adminName: clinic.owner_name ?? "Admin",
            });
      await sendEmail({ to: clinic.owner_email, ...template });
    } catch (emailErr) {
      logger.warn("Failed to send clinic status email", {
        context: "super-admin-actions",
        clinicId,
        error: emailErr,
      });
    }
  }
}

export async function deleteClinicImpl(
  clinicId: string,
  options: { force?: boolean } = {},
): Promise<{ deleted: true; patientCount: number }> {
  const profile = await requireRole("super_admin");
  assertClinicId(clinicId, "super-admin.deleteClinic");

  const supabase = await createClient();

  const { data: clinic, error: fetchError } = await supabase
    .from("clinics")
    .select("id, name, subdomain")
    .eq("id", clinicId)
    .single();

  if (fetchError || !clinic) {
    throw new Error(`Clinic not found: ${fetchError?.message ?? clinicId}`);
  }

  const { count: patientCountRaw } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("role", "patient");

  const patientCount = patientCountRaw ?? 0;
  if (patientCount > 0 && !options.force) {
    throw new Error(
      `Refusing to delete "${clinic.name}": it still has ${patientCount} patient record(s). ` +
        `Confirm again with the "erase patient data" option to permanently remove it.`,
    );
  }

  try {
    await supabase
      .from("activity_logs")
      .insert({
        action: "clinic_deleted",
        description:
          `Clinic "${clinic.name}" (id ${clinic.id}, subdomain ${clinic.subdomain ?? "—"}) ` +
          `permanently deleted by ${profile.name ?? "super_admin"}` +
          (patientCount > 0 ? ` — ${patientCount} patient record(s) erased` : ""),
        type: "clinic",
        timestamp: new Date().toISOString(),
      });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", {
      context: "super-admin-actions",
      clinicId,
      error: err,
    });
  }

  const admin = createAdminClient("super_admin");
  const { error: deleteError } = await admin.from("clinics").delete().eq("id", clinicId);

  if (deleteError) {
    throw new Error(`Failed to delete clinic: ${deleteError.message}`);
  }

  if (clinic.subdomain) {
    invalidateSubdomainCache(clinic.subdomain);
  }

  return { deleted: true, patientCount };
}
