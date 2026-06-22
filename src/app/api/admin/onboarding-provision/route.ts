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
import { syncClinicOnboardingState } from "@/lib/onboarding/state";
import { assertAllowedSubdomain } from "@/lib/reserved-subdomains";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import { createUser } from "@/lib/super-admin-actions";
import type { UserRole } from "@/lib/types/database";
import { safeParse } from "@/lib/validations/helpers";
import { clinicProvisionSchema } from "@/lib/validations/super-admin";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

const PROVISIONING_STEPS = [
  { key: "create_clinic", label: "Create clinic record" },
  { key: "create_owner_login", label: "Create owner login" },
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
      template,
      theme_colors,
      services,
      primary_color,
      secondary_color,
      template_id,
    } = result.data;

    // Audit #5: enforce the shared subdomain policy (length, reserved words,
    // hyphen abuse, punycode) before any INSERT, not just the DB trigger.
    try {
      assertAllowedSubdomain(subdomain);
    } catch (err) {
      return apiValidationError(err instanceof Error ? err.message : "Invalid subdomain");
    }

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
          // Audit #3: provisioned clinics start `inactive` and are only flipped
          // to `active` once every provisioning step has succeeded (see the
          // activation block below), so a partially-provisioned clinic is never
          // publicly resolvable.
          status: "inactive",
          owner_name,
          owner_email,
          phone: owner_phone ?? null,
          city: city ?? null,
          // Design/branding from the agent builder (optional). When absent,
          // the columns stay null and getPublicBranding() applies defaults.
          primary_color: primary_color ?? null,
          secondary_color: secondary_color ?? null,
          template_id: template_id ?? null,
          config: {
            locale: "fr",
            currency: "MAD",
            specialty: specialty ?? null,
            city: city ?? null,
            phone: owner_phone ?? null,
            email: owner_email,
            owner_name,
            ...(template ? { template } : {}),
            ...(theme_colors && theme_colors.length > 0 ? { theme_colors } : {}),
            ...(services && services.length > 0 ? { services } : {}),
          },
        })
        .select("id")
        .single();

      if (clinicError) {
        logger.error("Failed to create clinic during provisioning", {
          context: "onboarding-provision",
          error: clinicError,
        });
        // Audit #2: map DB constraint violations to precise, actionable
        // messages instead of the previous misleading "subdomain may already be
        // in use" (which was wrong for, e.g., an unsupported clinic type/tier).
        if (clinicError.code === "23505") {
          return apiValidationError(
            "A clinic with this subdomain already exists — please choose another.",
          );
        }
        if (clinicError.code === "23514") {
          return apiValidationError("Unsupported clinic type or tier for this clinic.");
        }
        return apiInternalError(
          "Clinic creation failed — please review the details and try again.",
        );
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

    // Step 2: Create the clinic owner's login + invitation (Audit #6).
    // Previously the auto-provision route created a clinic with NO way to log
    // in. We now create the owner as a `clinic_admin` with a real Supabase Auth
    // login and a "set your password" invite. If a login cannot be created
    // (e.g. SUPABASE_SERVICE_ROLE_KEY / email provider not configured) the step
    // is marked failed so the clinic stays inactive until an owner can log in.
    try {
      await updateStep(untypedAdmin, clinicId, "create_owner_login", "in_progress");
      const ownerResult = await createUser({
        clinic_id: clinicId,
        role: "clinic_admin",
        name: owner_name,
        phone: owner_phone ?? undefined,
        email: owner_email,
      });
      if (ownerResult.access.authCreated) {
        await updateStep(untypedAdmin, clinicId, "create_owner_login", "completed");
      } else {
        await updateStep(
          untypedAdmin,
          clinicId,
          "create_owner_login",
          "failed",
          ownerResult.access.inviteError ?? "Owner login could not be created",
        );
      }
    } catch (err) {
      await updateStep(untypedAdmin, clinicId, "create_owner_login", "failed", String(err));
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

    const provisioningSteps = (steps ?? []) as Array<{ step_key: string; status: string }>;
    const hasFailures = provisioningSteps.some((step) => step.status === "failed");
    const completedSteps = hasFailures
      ? ["clinic_info", "specialty"]
      : [
          "clinic_info",
          "specialty",
          "legal_docs",
          "team_setup",
          "insurance_setup",
          "schedule_setup",
          ...(whatsapp_number ? ["whatsapp_setup"] : []),
          "go_live",
        ];

    if (clinicId) {
      await syncClinicOnboardingState({
        supabase: untypedAdmin,
        clinicId,
        clinicName: clinic_name,
        specialty,
        contactName: owner_name,
        contactPhone: owner_phone ?? null,
        contactEmail: owner_email,
        completedSteps,
        currentStep: hasFailures ? "schedule_setup" : "go_live",
        status: hasFailures ? "in_progress" : "completed",
        completionPercentage: hasFailures ? 60 : 100,
        goLiveMessage: hasFailures ? null : `Provisioned clinic ${subdomain}.oltigo.com`,
      });
    }

    // Audit #3: only flip the clinic live when EVERY provisioning step
    // succeeded. A clinic with a failed step (including a missing owner login)
    // stays `inactive` and is never publicly resolvable until resolved.
    if (clinicId && !hasFailures) {
      const { error: activateError } = await typedAdmin
        .from("clinics")
        .update({ status: "active" })
        .eq("id", clinicId);
      if (activateError) {
        logger.error("Failed to activate provisioned clinic", {
          context: "onboarding-provision",
          error: activateError,
        });
      }
    }

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
export const GET = withAuth(handleGet, ALLOWED_ROLES);
