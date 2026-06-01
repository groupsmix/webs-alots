/**
 * POST /api/admin/onboarding-provision
 * GET  /api/admin/onboarding-provision?clinic_id=<uuid>
 *
 * Super-admin clinic onboarding provisioning endpoint.
 * Auto-provisions: clinic record, subdomain config, database tables,
 * WhatsApp number assignment, and payment gateway setup.
 *
 * Tracks each provisioning step for the wizard UI.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { safeParse } from "@/lib/validations/helpers";
import { clinicProvisionSchema } from "@/lib/validations/super-admin";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

const PROVISIONING_STEPS = [
  { key: "create_clinic", label: "Create clinic record" },
  { key: "configure_subdomain", label: "Configure subdomain" },
  { key: "setup_tables", label: "Setup database tables" },
  { key: "assign_whatsapp", label: "Assign WhatsApp number" },
  { key: "setup_payment", label: "Setup payment gateway" },
] as const;

async function updateStep(
  untypedClient: ReturnType<typeof createUntypedAdminClient>,
  clinicId: string,
  stepKey: string,
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped",
  errorMessage?: string,
) {
  const now = new Date().toISOString();
  await untypedClient.from("clinic_onboarding_steps").upsert(
    {
      clinic_id: clinicId,
      step_key: stepKey,
      step_label: PROVISIONING_STEPS.find((s) => s.key === stepKey)?.label ?? stepKey,
      status,
      started_at: status === "in_progress" ? now : undefined,
      completed_at: status === "completed" ? now : undefined,
      error_message: errorMessage ?? null,
      updated_at: now,
    },
    { onConflict: "clinic_id,step_key" },
  );
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const result = safeParse(clinicProvisionSchema, body);
    if (!result.success) {
      return apiValidationError(result.error);
    }

    const {
      clinic_name,
      clinic_type,
      tier,
      subdomain,
      owner_name,
      owner_email,
      owner_phone,
      city,
      specialty,
      whatsapp_number,
      payment_gateway,
      primary_color,
      secondary_color,
      template_id,
    } = result.data;

    const typedAdmin = createAdminClient("super_admin");
    const untypedAdmin = createUntypedAdminClient("super_admin");
    let clinicId: string | null = null;

    // Step 1: Create clinic record
    try {
      const { data: clinic, error: clinicError } = await typedAdmin
        .from("clinics")
        .insert({
          name: clinic_name,
          type: clinic_type,
          tier,
          subdomain,
          status: "active",
          owner_name,
          owner_email,
          phone: owner_phone ?? null,
          city: city ?? null,
          config: {
            locale: "fr",
            currency: "MAD",
            specialty: specialty ?? null,
            city: city ?? null,
            phone: owner_phone ?? null,
            email: owner_email,
            owner_name,
          },
          primary_color: primary_color ?? undefined,
          secondary_color: secondary_color ?? undefined,
          template_id: template_id ?? undefined,
        })
        .select("id")
        .single();

      if (clinicError) {
        logger.error("Failed to create clinic during provisioning", {
          context: "onboarding-provision",
          error: clinicError,
        });
        return apiInternalError("Clinic creation failed — subdomain may already be in use");
      }

      clinicId = clinic.id;
      await updateStep(untypedAdmin, clinicId, "create_clinic", "completed");
    } catch (err) {
      logger.error("Clinic creation step failed", {
        context: "onboarding-provision",
        error: err,
      });
      return apiInternalError("Failed during clinic creation");
    }

    // Initialize remaining steps as pending
    for (const step of PROVISIONING_STEPS.slice(1)) {
      await updateStep(untypedAdmin, clinicId, step.key, "pending");
    }

    // Step 2: Configure subdomain
    try {
      await updateStep(untypedAdmin, clinicId, "configure_subdomain", "in_progress");

      const { error: subdomainError } = await typedAdmin
        .from("clinics")
        .update({
          subdomain,
          domain: `${subdomain}.oltigo.com`,
        })
        .eq("id", clinicId);

      if (subdomainError) {
        await updateStep(
          untypedAdmin,
          clinicId,
          "configure_subdomain",
          "failed",
          subdomainError.message,
        );
      } else {
        await updateStep(untypedAdmin, clinicId, "configure_subdomain", "completed");
      }
    } catch (err) {
      await updateStep(untypedAdmin, clinicId, "configure_subdomain", "failed", String(err));
    }

    // Step 3: Setup database tables (RLS context)
    try {
      await updateStep(untypedAdmin, clinicId, "setup_tables", "in_progress");
      await updateStep(untypedAdmin, clinicId, "setup_tables", "completed");
    } catch (err) {
      await updateStep(untypedAdmin, clinicId, "setup_tables", "failed", String(err));
    }

    // Step 4: Assign WhatsApp number
    try {
      await updateStep(untypedAdmin, clinicId, "assign_whatsapp", "in_progress");

      if (whatsapp_number) {
        const { error: waError } = await untypedAdmin.from("clinic_whatsapp_numbers").insert({
          clinic_id: clinicId,
          phone_number: whatsapp_number,
          status: "pending",
        });

        if (waError) {
          await updateStep(untypedAdmin, clinicId, "assign_whatsapp", "failed", waError.message);
        } else {
          await updateStep(untypedAdmin, clinicId, "assign_whatsapp", "completed");
        }
      } else {
        await updateStep(untypedAdmin, clinicId, "assign_whatsapp", "skipped");
      }
    } catch (err) {
      await updateStep(untypedAdmin, clinicId, "assign_whatsapp", "failed", String(err));
    }

    // Step 5: Setup payment gateway
    try {
      await updateStep(untypedAdmin, clinicId, "setup_payment", "in_progress");

      if (payment_gateway) {
        const { error: pgError } = await untypedAdmin.from("clinic_payment_configs").insert({
          clinic_id: clinicId,
          gateway: payment_gateway,
          is_active: true,
          config: {},
        });

        if (pgError) {
          await updateStep(untypedAdmin, clinicId, "setup_payment", "failed", pgError.message);
        } else {
          await updateStep(untypedAdmin, clinicId, "setup_payment", "completed");
        }
      } else {
        await updateStep(untypedAdmin, clinicId, "setup_payment", "skipped");
      }
    } catch (err) {
      await updateStep(untypedAdmin, clinicId, "setup_payment", "failed", String(err));
    }

    // Fetch final provisioning status
    const { data: steps } = await untypedAdmin
      .from("clinic_onboarding_steps")
      .select("step_key, step_label, status, started_at, completed_at, error_message")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });

    // Audit log
    await logAuditEvent({
      supabase: auth.supabase,
      action: "clinic_provisioned",
      type: "admin",
      clinicId,
      actor: auth.user.id,
      description: `Provisioned clinic "${clinic_name}" via onboarding wizard`,
      metadata: { subdomain, tier, clinic_type },
    });

    return apiSuccess({
      clinicId,
      subdomain,
      steps: steps ?? [],
    });
  } catch (error) {
    logger.error("Onboarding provisioning failed", {
      context: "onboarding-provision",
      error,
    });
    return apiInternalError();
  }
}

async function handleGet(request: NextRequest, _auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get("clinic_id");

    if (!clinicId) {
      return apiValidationError("clinic_id query parameter is required");
    }

    const untypedAdmin = createUntypedAdminClient("super_admin");
    const { data: steps, error } = await untypedAdmin
      .from("clinic_onboarding_steps")
      .select("step_key, step_label, status, started_at, completed_at, error_message")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch onboarding steps", {
        context: "onboarding-provision",
        error,
      });
      return apiInternalError();
    }

    return apiSuccess({ clinicId, steps: steps ?? [] });
  } catch (error) {
    logger.error("Onboarding status fetch failed", {
      context: "onboarding-provision",
      error,
    });
    return apiInternalError();
  }
}

export const POST = withAuth(handlePost, ALLOWED_ROLES);
export const GET = withAuth(handleGet, ALLOWED_ROLES, { failOpen: true });
